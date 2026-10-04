import { summarizeQuizzes } from "../repositories/attemptRepository";
import {
  deleteQuizForUser,
  findQuizForUser,
  insertQuiz,
  listQuestions,
  listQuizzes,
  toQuestionResponse,
  toQuizResponse,
  updateQuizForUser,
} from "../repositories/quizRepository";
import { NotFoundError, ValidationError, ConflictError } from "../errors";
import { getEnv } from "../config/env";
import { logger } from "../logger";
import { generateQuestions, QuizGenerationError } from "./quizGenerationService";

/* ---------------- Duplicate-generation guard ----------------
   A double-clicked "Generate" button must not fire two full AI generations
   for the same configuration at the same time. The first request owns the
   slot; concurrent duplicates get a 409 instead of a second bill. */

const globalForQuizLocks = globalThis as typeof globalThis & {
  __quizCreationLocks?: Map<string, number>;
};

function creationLocks(): Map<string, number> {
  globalForQuizLocks.__quizCreationLocks ??= new Map();
  return globalForQuizLocks.__quizCreationLocks;
}

/** Deterministic signature of what the user asked for. */
function quizRequestKey(userId: string, input: QuizCreateInput): string {
  return [
    userId,
    input.subject,
    input.topic,
    input.difficulty,
    input.questionType,
    input.questionCount,
    input.sourceMode,
    (input.configuration.fileIds ?? []).slice().sort().join(","),
    input.configuration.contentMode,
    input.configuration.language,
  ].join("|");
}

function claimQuizCreation(key: string): void {
  const locks = creationLocks();
  const now = Date.now();
  for (const [k, expiresAt] of locks) {
    if (expiresAt <= now) locks.delete(k);
  }
  if (locks.has(key)) {
    throw new ConflictError(
      "A quiz with this configuration is already being generated. Wait for it to finish."
    );
  }
  // 3 minutes: longer than any bounded generation attempt.
  locks.set(key, now + 180_000);
}

function releaseQuizCreation(key: string): void {
  creationLocks().delete(key);
}

/** Test hook: clears generation slots between test cases. */
export function resetQuizCreationLocksForTesting(): void {
  globalForQuizLocks.__quizCreationLocks = undefined;
}
import type {
  Page,
  QuizGenerationInfo,
  QuizQuestionResponse,
  QuizResponse,
} from "@/lib/api/contracts";
import type { QuizCreateInput, QuizUpdateInput } from "@/lib/api/schemas";

/**
 * Quiz service.
 *
 * Quiz creation runs the real generation pipeline: validate, generate
 * questions through AIService, validate the output, then persist quiz and
 * questions in one transaction. A generation failure produces no row and a
 * clear error — never a half-written quiz.
 */

export async function list(
  userId: string,
  options: { limit: number; cursor?: string; search?: string }
): Promise<Page<QuizResponse>> {
  const { items, nextCursor } = await listQuizzes({
    userId,
    limit: options.limit,
    cursor: options.cursor ?? null,
    search: options.search,
  });

  const summary = await summarizeQuizzes(items.map((item) => item.id));
  return {
    items: items.map((row) => {
      const extra = summary.get(row.id);
      return {
        ...toQuizResponse(row),
        questionTotal: extra?.questionTotal ?? 0,
        latestAttempt: extra?.latestAttempt ?? null,
      };
    }),
    nextCursor,
  };
}

export type QuizCreateResult = {
  quiz: QuizResponse;
  questions: QuizQuestionResponse[];
  generation: QuizGenerationInfo;
};

function validateQuestionCount(questionCount: number): void {
  const env = getEnv();
  if (
    !Number.isInteger(questionCount) ||
    questionCount < env.QUIZ_MIN_QUESTIONS ||
    questionCount > env.QUIZ_MAX_QUESTIONS
  ) {
    throw new ValidationError(
      `Question count must be between ${env.QUIZ_MIN_QUESTIONS} and ${env.QUIZ_MAX_QUESTIONS}.`,
      { details: { questionCount: ["Out of the allowed range."] } }
    );
  }
}

export async function create(
  userId: string,
  input: QuizCreateInput
): Promise<QuizCreateResult> {
  validateQuestionCount(input.questionCount);

  const lockKey = quizRequestKey(userId, input);
  claimQuizCreation(lockKey);
  try {
  const mode = input.configuration.contentMode;
  if (
    (mode === "upload" || mode === "topic+upload") &&
    (input.configuration.fileIds ?? []).length === 0
  ) {
    throw new ValidationError("Add at least one uploaded file to ground the quiz.", {
      details: { files: ["No file selected."] },
    });
  }
  if (mode === "instructions" && input.configuration.customInstructions.trim().length === 0) {
    throw new ValidationError("Custom instructions are required for this content mode.");
  }

  if ((input.configuration.fileIds ?? []).length > 0) {
    const { requireUsableFiles } = await import("./fileContextService");
    await requireUsableFiles(userId, input.configuration.fileIds ?? []);
  }

  let result;
  try {
    result = await generateQuestions({ userId, config: input, source: input.sourceMode });
  } catch (error) {
    if (error instanceof QuizGenerationError) {
      logger.warn("Quiz generation failed", { userId, code: error.code });
      throw new ValidationError(error.message, {
        details: { generation: [error.code] },
      });
    }
    throw error;
  }

  const title =
    input.title?.trim() ||
    `${input.topic || input.subject || "Untitled"} — ${input.difficulty}`;
  const { quiz, questions } = await insertQuiz(
    userId,
    { ...input, title, status: "ready", questionCount: result.questions.length },
    result.questions.map((question) => ({
      statement: question.statement,
      questionType: question.questionType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      sourceMetadata: question.sourceMetadata,
      source: question.source,
    }))
  );

  logger.info("Quiz created", { userId, route: "quizzes", questions: questions.length });
    return {
      quiz: toQuizResponse(quiz),
      questions: questions.map((row) => toQuestionResponse(row, true)),
      generation: {
        connected: true,
        model: result.model,
        requestedModel: result.requestedModel,
        fallbackUsed: result.fallbackUsed,
        durationMs: result.durationMs,
      },
    };
  } finally {
    releaseQuizCreation(lockKey);
  }
}

export async function getById(userId: string, quizId: string): Promise<QuizResponse> {
  const row = await findQuizForUser(quizId, userId);
  if (!row) throw new NotFoundError("Quiz not found.");
  return toQuizResponse(row);
}

export async function update(
  userId: string,
  quizId: string,
  input: QuizUpdateInput
): Promise<QuizResponse> {
  const row = await updateQuizForUser(quizId, userId, input);
  if (!row) throw new NotFoundError("Quiz not found.");
  return toQuizResponse(row);
}

export async function remove(userId: string, quizId: string): Promise<void> {
  const removed = await deleteQuizForUser(quizId, userId);
  if (!removed) throw new NotFoundError("Quiz not found.");
  logger.info("Quiz deleted", { userId, route: "quizzes" });
}

/**
 * Returns a quiz's questions. `includeAnswers` stays false while an attempt is
 * active so the correct answers are never sent to a client mid-quiz.
 */
export async function getQuestions(
  userId: string,
  quizId: string,
  includeAnswers = true
): Promise<QuizQuestionResponse[]> {
  const quiz = await findQuizForUser(quizId, userId);
  if (!quiz) throw new NotFoundError("Quiz not found.");

  const rows = await listQuestions(quizId);
  return rows.map((row) => toQuestionResponse(row, includeAnswers));
}

/** Existence check used before creating an attempt. */
export async function assertOwned(userId: string, quizId: string): Promise<void> {
  const quiz = await findQuizForUser(quizId, userId);
  if (!quiz) throw new NotFoundError("Quiz not found.");
}