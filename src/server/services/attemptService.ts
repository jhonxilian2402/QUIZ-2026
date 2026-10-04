import {
  completeAttempt,
  expireAttempt,
  findAttemptForUser,
  insertAttempt,
  isAttemptExpired,
  listAnswers,
  listAttemptsForQuiz,
  listQuestionIdsForQuiz,
  recordAnswer,
  toAnswerResponse,
  toAttemptResponse,
} from "../repositories/attemptRepository";
import { findQuizForUser } from "../repositories/quizRepository";
import { NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import type {
  AttemptStatus,
  Page,
  QuizAnswerResponse,
  QuizAttemptResponse,
} from "@/lib/api/contracts";

/**
 * Quiz attempt service.
 *
 * Correctness and scoring are computed on the server from stored questions.
 * Nothing the client sends about correctness, counts or score is trusted.
 */

export async function startAttempt(
  userId: string,
  quizId: string
): Promise<QuizAttemptResponse> {
  const quiz = await findQuizForUser(quizId, userId);
  if (!quiz) throw new NotFoundError("Quiz not found.");

  if (quiz.status !== "ready") {
    throw new ValidationError("This quiz is not ready to be taken.");
  }

  const questionIds = await listQuestionIdsForQuiz(quizId);
  if (questionIds.length === 0) {
    throw new ValidationError("This quiz has no questions yet.");
  }

  const startedAt = new Date();
  const expiresAt =
    quiz.timeLimit !== null && quiz.timeLimit > 0
      ? new Date(startedAt.getTime() + quiz.timeLimit * 60_000)
      : null;

  const attempt = await insertAttempt({ quizId, userId, startedAt, expiresAt });
  logger.info("Attempt started", { userId, route: "attempts" });
  return toAttemptResponse(attempt);
}

export async function getAttempt(
  userId: string,
  attemptId: string
): Promise<{ attempt: QuizAttemptResponse; answers: QuizAnswerResponse[] }> {
  let attempt = await findAttemptForUser(attemptId, userId);
  if (!attempt) throw new NotFoundError("Attempt not found.");
  if (isAttemptExpired(attempt)) attempt = await expireAttempt(attempt);

  const answers = await listAnswers(attemptId);
  return {
    attempt: toAttemptResponse(attempt),
    answers: answers.map(toAnswerResponse),
  };
}

export async function listAttempts(
  userId: string,
  quizId: string,
  options: { limit: number; cursor?: string }
): Promise<Page<QuizAttemptResponse>> {
  const quiz = await findQuizForUser(quizId, userId);
  if (!quiz) throw new NotFoundError("Quiz not found.");

  const { items, nextCursor } = await listAttemptsForQuiz({
    quizId,
    userId,
    limit: options.limit,
    cursor: options.cursor ?? null,
  });

  const settled = await Promise.all(
    items.map(async (row) => (isAttemptExpired(row) ? expireAttempt(row) : row))
  );
  return { items: settled.map(toAttemptResponse), nextCursor };
}

/**
 * Submits one answer. The stored question decides correctness; the client only
 * chooses an option. Submitting the same question again updates the answer.
 */
export async function submitAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  selectedAnswer: string | null
): Promise<QuizAnswerResponse> {
  const attempt = await findAttemptForUser(attemptId, userId);
  if (!attempt) throw new NotFoundError("Attempt not found.");

  if (isAttemptExpired(attempt)) {
    await expireAttempt(attempt);
    throw new ValidationError("This attempt has expired.");
  }

  if (attempt.status !== ("in-progress" satisfies AttemptStatus)) {
    throw new ValidationError("This attempt is already completed.");
  }

  // The question must belong to the attempt's quiz, otherwise a user could
  // answer a question from an unrelated quiz.
  const questionIds = await listQuestionIdsForQuiz(attempt.quizId);
  if (!questionIds.includes(questionId)) {
    throw new ValidationError("That question does not belong to this quiz.");
  }

  const result = await recordAnswer({ attemptId, questionId, selectedAnswer });
  if (!result) throw new NotFoundError("Question not found.");

  return toAnswerResponse(result.answer);
}

export async function complete(
  userId: string,
  attemptId: string
): Promise<QuizAttemptResponse> {
  const attempt = await findAttemptForUser(attemptId, userId);
  if (!attempt) throw new NotFoundError("Attempt not found.");
  if (attempt.status === "abandoned") {
    throw new ValidationError("This attempt was abandoned.");
  }

  const row = await completeAttempt(attemptId, userId);
  if (!row) throw new NotFoundError("Attempt not found.");
  logger.info("Attempt completed", { userId, route: "attempts", status: row.score ?? 0 });
  return toAttemptResponse(row);
}