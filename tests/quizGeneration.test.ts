import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { freshDatabase, createTestUser } from "./helpers";
import { loadEnv, setEnvForTesting } from "../src/server/config/env";
import { registerProvider, clearProviders } from "../src/server/providers/registry";
import {
  resetBuiltinProvidersForTesting,
  ensureBuiltinProviders,
} from "../src/server/providers/builtins";
import { resetCatalogForTesting } from "../src/server/services/modelCatalogService";
import { getDb, ensureDbReady } from "../src/server/db/client";
import { quizzes, quizQuestions } from "../src/server/db/schema";
import type { AIProvider, AIStreamEvent } from "../src/server/providers/types";
import type { QuizCreateInput } from "../src/lib/api/schemas";

/**
 * Part 8 — generation, validation, scoring and timer security.
 *
 * The provider is a stub registered through the same registry OpenRouter uses,
 * so the real pipeline (prompt → AIService → validation → persistence) runs
 * without touching the network.
 */

const DUMMY_KEY = "sk-or-v1-test-only-dummy-key-not-a-real-credential";

function stubModel(id: string) {
  return {
    id,
    provider: "openrouter" as const,
    name: id,
    description: null,
    contextLength: 128000,
    capabilities: {
      text: true,
      vision: false,
      imageInput: false,
      fileInput: false,
      streaming: true,
      toolCalling: false,
      structuredOutput: true,
    },
    pricing: { input: 0, output: 0 },
    isFree: true,
    isAvailable: true,
  };
}

let generateCalls: Array<unknown> = [];

type StubBehavior = {
  /** Returns one raw AI response per call, in order; last one repeats. */
  responses: string[];
};

function registerStub(behavior: StubBehavior) {
  generateCalls = [];
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => [stubModel("vendor/free")],
    generate: async (request) => {
      generateCalls.push(request);
      const content =
        behavior.responses[Math.min(generateCalls.length - 1, behavior.responses.length - 1)];
      return {
        content,
        model: request.model,
        requestedModel: request.model,
        fallbackUsed: false,
        usage: null,
      };
    },
    stream: (request) =>
      (async function* (): AsyncIterable<AIStreamEvent> {
        yield {
          type: "start",
          model: request.model,
          requestedModel: request.model,
          fallbackUsed: false,
        };
        yield { type: "complete" };
      })(),
    validateConfiguration: async () => ({ ok: true }),
    supports: () => true,
  };
  ensureBuiltinProviders();
  registerProvider(provider);
  return provider;
}

beforeEach(async () => {
  await freshDatabase();
  clearProviders();
  resetBuiltinProvidersForTesting();
  resetCatalogForTesting();
  setEnvForTesting({ ...loadEnv(), OPENROUTER_API_KEY: DUMMY_KEY });
});

function mc(statement: string, correct = "A") {
  return {
    type: "multiple_choice",
    statement,
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: "Option B" },
      { id: "C", text: "Option C" },
      { id: "D", text: "Option D" },
    ],
    correctAnswer: correct,
    explanation: `Because ${correct} is the accurate option.`,
  };
}

function aiJson(questions: unknown[]): string {
  return JSON.stringify({ questions });
}

function quizInput(overrides: Partial<QuizCreateInput> = {}): QuizCreateInput {
  return {
    title: "Quadratic equations",
    subject: "Mathematics",
    topic: "Quadratic equations",
    difficulty: "medium",
    questionType: "multiple-choice",
    academicLevel: "high-school",
    questionCount: 3,
    sourceMode: "ai",
    timeLimit: null,
    status: "draft",
    configuration: {
      contentMode: "topic",
      language: "en",
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

test("valid configuration generates and persists a ready quiz", async () => {
  registerStub({
    responses: [
      aiJson([
        mc("What is 2 + 2?"),
        mc("What is the degree of a quadratic polynomial?"),
        mc("How many roots can a quadratic equation have?", "B"),
      ]),
    ],
  });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  const result = await quizService.create(userId, quizInput());
  assert.equal(result.quiz.status, "ready");
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[2].correctAnswer, "B");
  assert.ok(result.questions[0].explanation);
  assert.ok(result.generation.model);

  await ensureDbReady();
  const rows = await getDb()
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, result.quiz.id));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, "ai");
});

test("malformed AI output triggers controlled recovery", async () => {
  registerStub({
    responses: [
      "Here are your questions:\n1. Not JSON at all",
      aiJson([mc("What is 2 + 2?"), mc("Quadratic formula resolvent?"), mc("Discriminant sign?", "C")]),
    ],
  });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  const result = await quizService.create(userId, quizInput());
  assert.equal(result.questions.length, 3);
  assert.equal(generateCalls.length, 2, "one malformed attempt then one recovered");
});

test("duplicate AI questions are detected and replaced", async () => {
  registerStub({
    responses: [
      aiJson([mc("Same question?"), mc("Same question?"), mc("Same  question?")]),
      aiJson([mc("A different follow-up?"), mc("And another one?")]),
    ],
  });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  const result = await quizService.create(userId, quizInput());
  const statements = result.questions.map((q) => q.statement);
  assert.equal(new Set(statements).size, 3, "no duplicate statements persisted");
  assert.equal(generateCalls.length, 2);
});

test("insufficient valid output fails cleanly with no quiz persisted", async () => {
  registerStub({
    responses: [
      aiJson([{ type: "multiple_choice", statement: "Broken", options: [], correctAnswer: "Z" }]),
      aiJson([{ type: "multiple_choice", statement: "Broken again" }]),
      aiJson([{ type: "multiple_choice", statement: "Still broken" }]),
    ],
  });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  await assert.rejects(
    () => quizService.create(userId, quizInput()),
    (error: unknown) =>
      error instanceof Error && error.message.includes("could not produce")
  );

  await ensureDbReady();
  const rows = await getDb().select().from(quizzes).where(eq(quizzes.userId, userId));
  assert.equal(rows.length, 0, "a failed generation must not leave a quiz row");
});

test("database source mode fails honestly when the bank is unreachable", async () => {
  registerStub({ responses: [aiJson([mc("unused")])] });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");
  const { setEnvForTesting, loadEnv } = await import("../src/server/config/env");
  const original = loadEnv();
  setEnvForTesting({ ...original, QUESTION_DB_BASE_URL: "http://questions.invalid:9" });
  try {
    await assert.rejects(
      () => quizService.create(userId, quizInput({ sourceMode: "database" })),
      (error: unknown) =>
        error instanceof Error && error.message.includes("database")
    );
  } finally {
    setEnvForTesting(original);
  }
});

test("question count limits are enforced server-side", async () => {
  registerStub({ responses: [aiJson([mc("unused")])] });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  await assert.rejects(
    () => quizService.create(userId, quizInput({ questionCount: 9999 })),
    (error: unknown) =>
      error instanceof Error && error.message.includes("Question count")
  );
});

test("deterministic scoring: 7 correct, 2 incorrect, 1 unanswered = 70", async () => {
  registerStub({ responses: [aiJson([mc("unused")])] });
  const { id: userId } = await createTestUser();
  const { insertQuiz } = await import("../src/server/repositories/quizRepository");
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const questions = Array.from({ length: 10 }, (_, index) => ({
    statement: `Question ${index + 1}?`,
    questionType: "multiple-choice",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    correctAnswer: "a",
    explanation: null,
    difficulty: "easy",
    sourceMetadata: null,
  }));
  const { quiz } = await insertQuiz(userId, quizInput({ questionCount: 10, status: "ready" }), questions);

  const attempt = await attemptService.startAttempt(userId, quiz.id);
  const ids = await listQuestionIdsForQuiz(quiz.id);

  for (let i = 0; i < 7; i += 1) {
    await attemptService.submitAnswer(userId, attempt.id, ids[i], "a");
  }
  for (let i = 7; i < 9; i += 1) {
    await attemptService.submitAnswer(userId, attempt.id, ids[i], "b");
  }
  // Question 10 left unanswered.

  const completed = await attemptService.complete(userId, attempt.id);
  assert.equal(completed.correctCount, 7);
  assert.equal(completed.incorrectCount, 2);
  assert.equal(completed.unansweredCount, 1);
  assert.equal(completed.score, 70);
  assert.equal(completed.status, "completed");

  const again = await attemptService.complete(userId, attempt.id);
  assert.equal(again.score, 70, "completion is idempotent");
});

test("timer expiry is decided by the server", async () => {
  registerStub({ responses: [aiJson([mc("unused")])] });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");
  const attemptService = await import("../src/server/services/attemptService");
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );

  const created = await quizService.create(
    userId,
    quizInput({ timeLimit: 15, questionCount: 1 })
  );
  const attempt = await attemptService.startAttempt(userId, created.quiz.id);
  assert.ok(attempt.expiresAt, "a timed quiz gets a server deadline");

  // Move the attempt's clock into the past.
  await ensureDbReady();
  const pastStart = new Date(Date.now() - 60 * 60_000);
  const pastExpiry = new Date(Date.now() - 1000);
  await getDb().execute(sql`update quiz_attempts set started_at = ${pastStart}, expires_at = ${pastExpiry} where id = ${attempt.id}`);

  const [questionId] = await listQuestionIdsForQuiz(created.quiz.id);
  await assert.rejects(
    () => attemptService.submitAnswer(userId, attempt.id, questionId, "A"),
    (error: unknown) => error instanceof Error && error.message.includes("expired")
  );

  const completed = await attemptService.complete(userId, attempt.id);
  assert.equal(completed.status, "expired");
});

test("submitAnswer never trusts a client score claim", async () => {
  registerStub({ responses: [aiJson([mc("unused")])] });
  const { id: userId } = await createTestUser();
  const { insertQuiz } = await import("../src/server/repositories/quizRepository");
  const attemptService = await import("../src/server/services/attemptService");

  const { quiz } = await insertQuiz(
    userId,
    quizInput({ status: "ready" }),
    [
      {
        statement: "What is 2 + 2?",
        questionType: "multiple-choice",
        options: [
          { id: "a", label: "4" },
          { id: "b", label: "5" },
        ],
        correctAnswer: "a",
        explanation: null,
        difficulty: null,
        sourceMetadata: null,
      },
    ]
  );
  const attempt = await attemptService.startAttempt(userId, quiz.id);

  // A crafted payload would fail strict schema validation at the API layer;
  // at the service layer the stored question decides correctness regardless.
  const { listQuestionIdsForQuiz } = await import(
    "../src/server/repositories/attemptRepository"
  );
  const [questionId] = await listQuestionIdsForQuiz(quiz.id);
  const answer = await attemptService.submitAnswer(
    userId,
    attempt.id,
    questionId,
    "b"
  );
  assert.equal(answer.isCorrect, false);

  const completed = await attemptService.complete(userId, attempt.id);
  assert.equal(completed.score, 0);
});
