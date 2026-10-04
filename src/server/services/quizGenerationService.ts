import { z } from "zod";
import { AIError } from "../errors";
import { getEnv } from "../config/env";
import { logger } from "../logger";
import { generate } from "./aiService";
import {
  fetchDatabaseQuestions,
  fetchWebResearchQuestions,
} from "./questionSourceService";
import {
  buildQuizMessages,
  buildFileQuizMessages,
  QUIZ_RESPONSE_FORMAT,
} from "./quizPromptBuilder";
import type { QuestionSource } from "@/lib/api/contracts";
import type { QuizCreateInput } from "@/lib/api/schemas";

/**
 * Quiz generation service.
 *
 * Owns the question pipeline for AI-backed quizzes: build the prompt, ask for
 * structured output, validate strictly, normalize, drop duplicates and only
 * then allow anything to be persisted. The AI is never trusted blindly, and
 * generation failures never leave a half-written quiz behind.
 *
 * QuestionDatabase and ResearchService sources are deliberately unavailable
 * until their phases land; "database"/"web"/"mixed" fail honestly rather than
 * silently falling back to AI output.
 */

export type GeneratedQuestion = {
  statement: string;
  questionType: "multiple-choice" | "true-false";
  options: Array<{ id: string; label: string }>;
  correctAnswer: string;
  explanation: string | null;
  difficulty: string | null;
  /** Honest provenance per question; quiz-level sourceMode can differ (mixed). */
  source: QuestionSource;
  sourceMetadata: Record<string, unknown> | null;
  /** Page the model cited; validated against real evidence pages later. */
  page: number | null;
};

export type GenerationContext = {
  userId: string;
  config: QuizCreateInput;
  source: QuestionSource;
};

export type GenerationResult = {
  questions: GeneratedQuestion[];
  model: string | null;
  requestedModel: string | null;
  fallbackUsed: boolean;
  durationMs: number;
};

export class QuizGenerationError extends Error {
  readonly code: "QUIZ_GENERATION_FAILED" | "QUIZ_GENERATION_TIMEOUT";

  constructor(
    code: "QUIZ_GENERATION_FAILED" | "QUIZ_GENERATION_TIMEOUT",
    message: string,
    options: { cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "QuizGenerationError";
    this.code = code;
  }
}

/* ---------------- Structured output validation ---------------- */

const rawOptionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1).max(2000),
});

const rawQuestionSchema = z
  .object({
    type: z.enum(["multiple_choice", "true_false"]),
    statement: z.string().trim().min(3).max(4000),
    options: z.array(rawOptionSchema).min(2).max(8),
    correctAnswer: z.string().trim().min(1).max(80),
    explanation: z.string().trim().max(4000).default(""),
    /** Optional provenance the model may cite from the evidence blocks. */
    page: z.number().int().positive().nullable().optional(),
  })
  .strict();

const rawResponseSchema = z
  .object({ questions: z.array(z.unknown()).max(100) })
  .strict();

/** Strip a single outer code fence if the model added one despite instructions. */
function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

export function normalizeStatement(statement: string): string {
  return statement
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

/**
 * Validates one raw AI question and normalizes it into the persisted shape.
 * Returns null when the question is unusable.
 */
export function normalizeQuestion(raw: unknown): GeneratedQuestion | null {
  const parsed = rawQuestionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;

  const seen = new Set<string>();
  for (const option of value.options) {
    const key = option.id.trim().toLowerCase();
    if (seen.has(key)) return null; // duplicate option id
    seen.add(key);
  }

  let options: Array<{ id: string; label: string }>;
  let correctAnswer: string;

  if (value.type === "multiple_choice") {
    if (value.options.length < 2) return null;
    options = value.options.map((option) => ({ id: option.id, label: option.text }));
    const ids = new Set(value.options.map((option) => option.id));
    if (!ids.has(value.correctAnswer)) {
      // Tolerate case/format drift on the correct answer id.
      const match = value.options.find(
        (option) => option.id.trim().toLowerCase() === value.correctAnswer.trim().toLowerCase()
      );
      if (!match) return null;
      correctAnswer = match.id;
    } else {
      correctAnswer = value.correctAnswer;
    }
  } else {
    const normalized = value.correctAnswer.trim().toLowerCase();
    if (normalized !== "true" && normalized !== "false") return null;
    correctAnswer = normalized;
    options = [
      { id: "true", label: "True" },
      { id: "false", label: "False" },
    ];
  }

  const explanation = value.explanation.trim();
  return {
    statement: value.statement.trim(),
    questionType: value.type === "multiple_choice" ? "multiple-choice" : "true-false",
    options,
    correctAnswer,
    explanation: explanation.length > 0 ? explanation : null,
    difficulty: null,
    sourceMetadata: null,
    source: "ai",
    page: value.page ?? null,
  };
}

export function parseGenerationContent(content: string): unknown[] {
  const text = stripCodeFence(content);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return [];
  }
  const envelope = rawResponseSchema.safeParse(parsedJson);
  if (!envelope.success) return [];
  return envelope.data.questions;
}

/* ---------------- Generation with controlled recovery ---------------- */

async function generateWithMessages(options: {
  config: QuizCreateInput;
  buildMessages: (missing: number, avoidStatements: string[]) => Array<{ role: string; content: string }>;
  source: QuestionSource;
  extraMetadata?: (response: { model: string | null }) => Record<string, unknown> | null;
}): Promise<GenerationResult> {
  const env = getEnv();
  const startedAt = Date.now();
  const collected: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  let model: string | null = null;
  let requestedModel: string | null = null;
  let fallbackUsed = false;
  let lastError: unknown = null;

  const desiredTypes = options.config.questionType;

  for (let attempt = 0; attempt < env.QUIZ_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    const missing = options.config.questionCount - collected.length;
    if (missing <= 0) break;

    const controller = AbortSignal.timeout(env.QUIZ_GENERATION_TIMEOUT_MS);
    try {
      const messages = options.buildMessages(
        missing,
        collected.map((question) => question.statement)
      ) as Parameters<typeof generate>[0]["messages"];

      const response = await (async () => {
        const call = (responseFormat: unknown) =>
          generate({
            messages,
            temperature: 0.7,
            maxTokens: Math.min(16000, Math.max(2000, missing * 500)),
            responseFormat: responseFormat as never,
            signal: controller,
          });
        let result;
        try {
          result = await call(QUIZ_RESPONSE_FORMAT);
        } catch (error) {
          const rejected =
            error instanceof AIError &&
            (error.aiCode === "AI_INVALID_REQUEST" || error.aiCode === "AI_CONTENT_ERROR");
          if (!rejected) throw error;
          result = await call(undefined);
        }
        return {
          questions: parseGenerationContent(result.content),
          model: result.model ?? null,
          requestedModel: result.requestedModel ?? null,
          fallbackUsed: result.fallbackUsed ?? false,
        };
      })();

      model = response.model ?? model;
      requestedModel = response.requestedModel ?? requestedModel;
      fallbackUsed = fallbackUsed || response.fallbackUsed;

      for (const raw of response.questions) {
        const normalized = normalizeQuestion(raw);
        if (!normalized) continue;
        if (
          desiredTypes !== "mixed" &&
          normalized.questionType !== desiredTypes
        ) {
          continue;
        }
        const key = normalizeStatement(normalized.statement);
        if (key.length === 0 || seen.has(key)) continue;
        seen.add(key);
        normalized.difficulty = options.config.difficulty;
        normalized.sourceMetadata = options.extraMetadata?.({ model: response.model }) ?? {
          model: response.model,
        };
        normalized.source = options.source;
        collected.push(normalized);
        if (collected.length >= options.config.questionCount) break;
      }
    } catch (error) {
      lastError = error;
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError");
      if (aborted) {
        throw new QuizGenerationError(
          "QUIZ_GENERATION_TIMEOUT",
          "Question generation timed out. Please try again.",
          { cause: error }
        );
      }
      if (error instanceof AIError) throw error;
      logger.warn("Quiz generation attempt failed", {
        attempt,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (collected.length < options.config.questionCount) {
    logger.warn("Quiz generation produced insufficient valid questions", {
      requested: options.config.questionCount,
      valid: collected.length,
    });
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      `The AI could not produce ${options.config.questionCount} valid questions. Please try again or adjust the configuration.`,
      { cause: lastError }
    );
  }

  return {
    questions: collected.slice(0, options.config.questionCount),
    model,
    requestedModel,
    fallbackUsed,
    durationMs: Date.now() - startedAt,
  };
}

export async function generateAiQuestions(
  config: QuizCreateInput
): Promise<GenerationResult> {
  return generateWithMessages({
    config,
    source: "ai",
    buildMessages: (missing, avoid) =>
      buildQuizMessages(config, { questionCount: missing, avoidStatements: avoid }) as Array<{ role: string; content: string }>,
  });
}

/**
 * File-grounded generation: questions are built strictly from the user's
 * extracted document chunks (ownership verified by FileContextService). The
 * citation metadata points back to specific file/page references.
 */
export async function generateFileQuestions(
  context: GenerationContext
): Promise<GenerationResult> {
  const fileIds = context.config.configuration.fileIds ?? [];
  if (fileIds.length === 0) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "No file was selected for this quiz mode. Attach an uploaded file first."
    );
  }

  const { fullEvidenceForFiles } = await import("./fileContextService");
  const evidence = await fullEvidenceForFiles({
    userId: context.userId,
    fileIds,
  });
  if (evidence.empty) {
    throw new QuizGenerationError(
      "QUIZ_GENERATION_FAILED",
      "The selected files could not be grounded: they are not ready or contain no extractable text."
    );
  }

  const allowedPages = new Set(
    evidence.citations.map((citation) => citation.page).filter((page) => page !== null)
  );

  const result = await generateWithMessages({
    config: context.config,
    source: "file",
    extraMetadata: () => ({
      source: "file",
      files: evidence.citations.map((citation) => ({
        fileId: citation.fileId,
        filename: citation.filename,
        page: citation.page,
      })),
    }),
    buildMessages: () =>
      buildFileQuizMessages(context.config, evidence.text) as Array<{ role: string; content: string }>,
  });

  // A page number is only kept when it is a real page from the evidence.
  for (const question of result.questions) {
    const cited = question.page;
    if (cited !== null && allowedPages.has(cited)) {
      question.sourceMetadata = {
        ...(question.sourceMetadata ?? {}),
        page: cited,
      };
    } else {
      question.page = null;
      if (question.sourceMetadata && "page" in question.sourceMetadata) {
        delete question.sourceMetadata.page;
      }
    }
  }
  return result;
}

/**
 * Entry point used by QuizService. Each source mode is honest about its
 * provider; "database" reads the real external question bank, "web" builds
 * questions from today-fetched web material, "mixed" always includes at least
 * one real database question and labels every question with its true source.
 */
export async function generateQuestions(
  context: GenerationContext
): Promise<GenerationResult> {
  switch (context.source) {
    case "ai": {
      const hasFiles = (context.config.configuration.fileIds ?? []).length > 0;
      if (hasFiles) {
        // Uploaded material is authoritative context when the user supplied it:
        // never silently generate from the model's prior instead.
        return generateFileQuestions(context);
      }
      return generateAiQuestions(context.config);
    }
    case "file":
      return generateFileQuestions(context);
    case "database": {
      const startedAt = Date.now();
      const questions = await fetchDatabaseQuestions(context.config, context.config.questionCount);
      return {
        questions: questions.map((question) => ({ ...question, source: "database" as const })),
        model: null,
        requestedModel: null,
        fallbackUsed: false,
        durationMs: Date.now() - startedAt,
      };
    }
    case "web": {
      const startedAt = Date.now();
      const questions = await fetchWebResearchQuestions(context.config, context.config.questionCount);
      return {
        questions: questions.map((question) => ({ ...question, source: "web" as const })),
        model: null,
        requestedModel: null,
        fallbackUsed: false,
        durationMs: Date.now() - startedAt,
      };
    }
    case "mixed": {
      const startedAt = Date.now();
      const share = Math.min(100, Math.max(0, context.config.configuration.databaseShare));
      const fileIds = context.config.configuration.fileIds ?? [];
      const useWebInsteadOfDb = context.config.configuration.databaseSource === "open-web";
      const dbCount = Math.max(1, Math.round((context.config.questionCount * share) / 100));
      const rest = context.config.questionCount - Math.min(dbCount, context.config.questionCount - 1);
      const fileCount = fileIds.length > 0 ? Math.max(1, Math.floor(rest / 2)) : 0;
      const aiCount = rest - fileCount;
      const retrievedCount = Math.min(dbCount, context.config.questionCount - fileCount - aiCount);

      let retrievedQuestions: GeneratedQuestion[];
      try {
        retrievedQuestions = useWebInsteadOfDb
          ? (await fetchWebResearchQuestions(context.config, retrievedCount)).map((question) => ({
              ...question,
              source: "web" as const,
            }))
          : (await fetchDatabaseQuestions(context.config, retrievedCount)).map((question) => ({
              ...question,
              source: "database" as const,
            }));
      } catch (error) {
        // Mixed mode must never silently degrade to all-AI: say so plainly.
        throw new QuizGenerationError(
          "QUIZ_GENERATION_FAILED",
          `Mixed mode requires real ${useWebInsteadOfDb ? "web" : "database"} questions, but that source produced none for this configuration. Retry, or choose the AI source.${error instanceof Error ? ` (${error.message})` : ""}`,
          { cause: error }
        );
      }

      let fileQuestions: GeneratedQuestion[] = [];
      if (fileIds.length > 0 && fileCount > 0) {
        const fileResult = await generateFileQuestions({
          ...context,
          config: { ...context.config, questionCount: fileCount },
        });
        fileQuestions = fileResult.questions.map((question) => ({
          ...question,
          source: "file" as const,
        }));
      }

      let aiQuestions: GeneratedQuestion[] = [];
      if (aiCount > 0) {
        const ai = await generateAiQuestions({
          ...context.config,
          questionCount: aiCount + retrievedCount - retrievedQuestions.length + fileCount - fileQuestions.length,
        });
        const taken = new Set(
          [...retrievedQuestions, ...fileQuestions].map((question) => normalizeStatement(question.statement))
        );
        aiQuestions = ai.questions
          .map((question) => ({ ...question, source: "ai" as const }))
          .filter((question) => !taken.has(normalizeStatement(question.statement)));
      }

      const combined = [...retrievedQuestions, ...fileQuestions, ...aiQuestions].slice(0, context.config.questionCount);
      if (combined.length < context.config.questionCount) {
        throw new QuizGenerationError(
          "QUIZ_GENERATION_FAILED",
          `Mixed generation produced ${combined.length} of ${context.config.questionCount} required questions.`
        );
      }
      return {
        questions: combined,
        model: null,
        requestedModel: null,
        fallbackUsed: false,
        durationMs: Date.now() - startedAt,
      };
    }
    default:
      throw new QuizGenerationError(
        "QUIZ_GENERATION_FAILED",
        "Unsupported question source."
      );
  }
}
