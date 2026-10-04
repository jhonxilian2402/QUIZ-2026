import { test, before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshDatabase, createTestUser } from "./helpers";
import { insertQuiz, toQuizResponse } from "../src/server/repositories/quizRepository";
import { ensureDbReady, getDb } from "../src/server/db/client";
import { quizQuestions } from "../src/server/db/schema";
import type { QuizCreateInput } from "../src/lib/api/schemas";

/**
 * Quiz persistence and answer correctness.
 *
 * Answer correctness is a security boundary: the server must determine it from
 * stored data. These cases insert a real question, then prove that a wrong
 * selection is recorded as incorrect and that final scoring is computed
 * server-side.
 */

before(async () => {
  await freshDatabase();
});

function quizInput(overrides: Partial<QuizCreateInput> = {}): QuizCreateInput {
  return {
    title: "Quadratic equations",
    subject: "Mathematics",
    topic: "Quadratic equations",
    difficulty: "medium",
    questionType: "multiple-choice",
    academicLevel: "high-school",
    questionCount: 2,
    sourceMode: "ai",
    timeLimit: null,
    status: "ready",
    configuration: {
      contentMode: "topic",
      language: "pt-BR",
      explanations: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      aiStyle: "balanced",
      databaseShare: 50,
      databaseSource: "",
      institution: "",
      year: "",
      academicLevel: "high-school",
      customInstructions: "",
    },
    ...overrides,
  };
}

/** Inserts a quiz with hand-authored questions so the questions are not fake. */
async function quizWithQuestions(userId: string, quizIdOverride?: string) {
  const { quiz } = await insertQuiz(userId, quizInput(), [
    {
      statement: "What is the discriminant of x^2 - 5x + 6?",
      questionType: "multiple-choice",
      options: [
        { id: "a", label: "1" },
        { id: "b", label: "2" },
        { id: "c", label: "3" },
      ],
      correctAnswer: "a",
      explanation: "b^2 - 4ac = 25 - 24 = 1",
      difficulty: "medium",
      sourceMetadata: null,
    },
    {
      statement: "x^2 - 5x + 6 factors as (x - 2)(x - 3).",
      questionType: "true-false",
      options: [
        { id: "true", label: "True" },
        { id: "false", label: "False" },
      ],
      correctAnswer: "true",
      explanation: null,
      difficulty: "easy",
      sourceMetadata: null,
    },
  ]);
  void quizIdOverride;
  return quiz;
}

test("a quiz is stored with its questions", async () => {
  const { id: userId } = await createTestUser();
  const quiz = await quizWithQuestions(userId);

  await ensureDbReady();
  const rows = await getDb()
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id));

  assert.equal(rows.length, 2);
  const response = toQuizResponse(quiz);
  assert.equal(response.subject, "Mathematics");
  assert.equal(response.sourceMode, "ai");
  assert.equal(response.questionCount, 2);
});

test("the server marks a wrong answer incorrect even though it was selected", async () => {
  const { id: userId } = await createTestUser();
  const quiz = await quizWithQuestions(userId);
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const attempt = await attemptService.startAttempt(userId, quiz.id);
  const [firstQuestionId] = await listQuestionIdsForQuiz(quiz.id);

  // The correct answer is "a"; the client submits "c".
  const answer = await attemptService.submitAnswer(userId, attempt.id, firstQuestionId, "c");
  assert.equal(answer.isCorrect, false, "server must derive correctness from stored data");
  assert.equal(answer.selectedAnswer, "c");
});

test("the server marks a correct answer correct", async () => {
  const { id: userId } = await createTestUser();
  const quiz = await quizWithQuestions(userId);
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const attempt = await attemptService.startAttempt(userId, quiz.id);
  const [firstQuestionId] = await listQuestionIdsForQuiz(quiz.id);

  const answer = await attemptService.submitAnswer(userId, attempt.id, firstQuestionId, "a");
  assert.equal(answer.isCorrect, true);
});

test("completion scores from stored answers, counting unanswered questions", async () => {
  const { id: userId } = await createTestUser();
  const quiz = await quizWithQuestions(userId);
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const attempt = await attemptService.startAttempt(userId, quiz.id);
  const questionIds = await listQuestionIdsForQuiz(quiz.id);

  // One correct, one left unanswered.
  await attemptService.submitAnswer(userId, attempt.id, questionIds[0], "a");
  const completed = await attemptService.complete(userId, attempt.id);

  assert.equal(completed.correctCount, 1);
  assert.equal(completed.unansweredCount, 1);
  assert.equal(completed.incorrectCount, 0);
  assert.equal(completed.score, 50, "1 of 2 correct is a score of 50");
  assert.equal(completed.status, "completed");
});

test("re-answering a question updates it rather than duplicating", async () => {
  const { id: userId } = await createTestUser();
  const quiz = await quizWithQuestions(userId);
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const attempt = await attemptService.startAttempt(userId, quiz.id);
  const [questionId] = await listQuestionIdsForQuiz(quiz.id);

  await attemptService.submitAnswer(userId, attempt.id, questionId, "c");
  const second = await attemptService.submitAnswer(userId, attempt.id, questionId, "a");
  assert.equal(second.isCorrect, true, "the latest answer wins");

  const completed = await attemptService.complete(userId, attempt.id);
  assert.equal(completed.correctCount, 1);
});

test("an answer for a question outside the quiz is rejected", async () => {
  const { id: userId } = await createTestUser();
  const quizA = await quizWithQuestions(userId);
  const quizB = await quizWithQuestions(userId);
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const attempt = await attemptService.startAttempt(userId, quizA.id);
  const [foreignQuestionId] = await listQuestionIdsForQuiz(quizB.id);

  await assert.rejects(
    () => attemptService.submitAnswer(userId, attempt.id, foreignQuestionId, "a"),
    (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR"
  );
});

test("another user cannot start an attempt on someone else's quiz", async () => {
  const alice = await createTestUser();
  const bob = await createTestUser();
  const quiz = await quizWithQuestions(alice.id);
  const attemptService = await import("../src/server/services/attemptService");

  await assert.rejects(
    () => attemptService.startAttempt(bob.id, quiz.id),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );
});

test("another user cannot read an attempt they do not own", async () => {
  const alice = await createTestUser();
  const bob = await createTestUser();
  const quiz = await quizWithQuestions(alice.id);
  const attemptService = await import("../src/server/services/attemptService");

  const attempt = await attemptService.startAttempt(alice.id, quiz.id);

  await assert.rejects(
    () => attemptService.getAttempt(bob.id, attempt.id),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );
});

test("a quiz without questions cannot be attempted", async () => {
  const { id: userId } = await createTestUser();
  const { quiz } = await insertQuiz(userId, quizInput(), []);
  const attemptService = await import("../src/server/services/attemptService");

  await assert.rejects(
    () => attemptService.startAttempt(userId, quiz.id),
    (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR",
    "an empty quiz must be refused rather than filled with invented questions"
  );
});