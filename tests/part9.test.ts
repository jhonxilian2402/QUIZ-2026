import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshDatabase, createTestUser } from "./helpers";
import { loadEnv, setEnvForTesting } from "../src/server/config/env";
import { clearProviders } from "../src/server/providers/registry";
import {
  resetBuiltinProvidersForTesting,
  ensureBuiltinProviders,
} from "../src/server/providers/builtins";
import { registerProvider } from "../src/server/providers/registry";
import { resetCatalogForTesting } from "../src/server/services/modelCatalogService";
import { ensureDbReady, getDb } from "../src/server/db/client";
import { quizzes, quizQuestions } from "../src/server/db/schema";
import type { AIProvider, AIStreamEvent } from "../src/server/providers/types";
import type { QuizCreateInput } from "../src/lib/api/schemas";

/**
 * Part 9 — real question database + real-time web research.
 *
 * Global fetch is stubbed for OpenTDB/Wikipedia so the services talk to the
 * same real URL shapes, and the AI provider is stubbed through the registry.
 */

const DUMMY_KEY = "sk-or-v1-test-only-dummy-key-not-a-real-credential";
const realFetch = globalThis.fetch;

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

let aiCalls = 0;

function registerAiStub(content: string) {
  aiCalls = 0;
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => [stubModel("vendor/free")],
    generate: async (request) => {
      aiCalls += 1;
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
        yield { type: "start", model: request.model, requestedModel: request.model, fallbackUsed: false };
        yield { type: "complete" };
      })(),
    validateConfiguration: async () => ({ ok: true }),
    supports: () => true,
  };
  ensureBuiltinProviders();
  registerProvider(provider);
}

const OPENTDB_PAYLOAD = {
  response_code: 0,
  results: [
    {
      type: "multiple",
      difficulty: "medium",
      category: "Science: Mathematics",
      question: "What is the value of 6 &times; 7?",
      correct_answer: "42",
      incorrect_answers: ["36", "48", "40"],
    },
    {
      type: "boolean",
      difficulty: "easy",
      category: "Science: Mathematics",
      question: "A prime number has exactly two distinct positive divisors.",
      correct_answer: "True",
      incorrect_answers: ["False"],
    },
    {
      type: "multiple",
      difficulty: "hard",
      category: "Science: Mathematics",
      question: "What is the derivative of x&sup2;?",
      correct_answer: "2x",
      incorrect_answers: ["x", "x&sup2;", "2"],
    },
  ],
};

const WIKI_SEARCH = {
  query: { search: [{ title: "Quadratic equation", snippet: "<b>Quadratic</b> equation article." }] },
};

const WIKI_EXTRACT = {
  query: {
    pages: {
      "1": {
        title: "Quadratic equation",
        extract:
          "A quadratic equation is a polynomial equation of degree 2, usually written as ax^2 + bx + c = 0. The solutions are called roots and can be found with the quadratic formula.",
      },
    },
  },
};

function stubFetch(handler: (url: string) => unknown | null) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const payload = handler(url);
    if (payload === null) {
      return new Response("upstream failure", { status: 500 });
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(async () => {
  await freshDatabase();
  clearProviders();
  resetBuiltinProvidersForTesting();
  resetCatalogForTesting();
  setEnvForTesting({ ...loadEnv(), OPENROUTER_API_KEY: DUMMY_KEY });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function quizInput(overrides: Partial<QuizCreateInput> = {}): QuizCreateInput {
  return {
    title: "Part 9 quiz",
    subject: "Mathematics",
    topic: "",
    difficulty: "medium",
    questionType: "multiple-choice",
    academicLevel: "high-school",
    questionCount: 2,
    sourceMode: "database",
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
      databaseSource: "public-exams",
      institution: "",
      year: "",
      academicLevel: "high-school",
      customInstructions: "",
    },
    ...overrides,
  };
}

test("database mode persists real questions with provenance", async () => {
  stubFetch((url) => {
    if (url.includes("opentdb.com")) return OPENTDB_PAYLOAD;
    return null;
  });
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  const result = await quizService.create(userId, quizInput());
  assert.equal(result.quiz.status, "ready");
  assert.equal(result.questions.length, 2);

  await ensureDbReady();
  const rows = await getDb()
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, result.quiz.id));
  assert.equal(rows[0].source, "database");
  assert.equal((rows[0].sourceMetadata as { provider?: string }).provider, "opentdb");
  // HTML entities from the real provider are decoded.
  assert.ok(!rows.some((row) => row.statement.includes("&times;")));
  assert.ok(rows[0].correctAnswer);
});

test("database mode fails honestly when the provider fails", async () => {
  stubFetch(() => null);
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  await assert.rejects(
    () => quizService.create(userId, quizInput()),
    (error: unknown) => error instanceof Error && error.message.includes("database")
  );
  const rows = await getDb().select().from(quizzes).where(eq(quizzes.userId, userId));
  assert.equal(rows.length, 0);
});

test("mixed mode uses real database questions plus labelled AI questions", async () => {
  stubFetch((url) => {
    if (url.includes("opentdb.com")) return OPENTDB_PAYLOAD;
    return null;
  });
  registerAiStub(
    JSON.stringify({
      questions: [
        {
          type: "multiple_choice",
          statement: "What is the sum of the interior angles of a triangle?",
          options: [
            { id: "A", text: "180" },
            { id: "B", text: "360" },
            { id: "C", text: "90" },
            { id: "D", text: "270" },
          ],
          correctAnswer: "A",
          explanation: "Interior angles of any triangle add to 180 degrees.",
        },
      ],
    })
  );
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  const result = await quizService.create(
    userId,
    quizInput({ sourceMode: "mixed", questionCount: 3 })
  );
  assert.equal(result.questions.length, 3);
  const bySource = result.questions.reduce<Record<string, number>>((acc, question) => {
    acc[question.source] = (acc[question.source] ?? 0) + 1;
    return acc;
  }, {});
  assert.equal(bySource["database"], 2, "50% share of 3 rounds to 2 database questions");
  assert.equal(bySource["ai"], 1);
  assert.ok(aiCalls > 0, "AI truly used for the remainder");
});

test("mixed mode fails instead of silently ignoring the database source", async () => {
  stubFetch(() => null);
  registerAiStub(JSON.stringify({ questions: [] }));
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  await assert.rejects(
    () => quizService.create(userId, quizInput({ sourceMode: "mixed", questionCount: 3 })),
    (error: unknown) => error instanceof Error && error.message.includes("Mixed")
  );
  const rows = await getDb().select().from(quizzes).where(eq(quizzes.userId, userId));
  assert.equal(rows.length, 0);
});

test("web mode grounds questions in today's retrieved material", async () => {
  stubFetch((url) => {
    if (url.includes("list=search")) return WIKI_SEARCH;
    if (url.includes("prop=extracts")) return WIKI_EXTRACT;
    return null;
  });
  registerAiStub(
    JSON.stringify({
      questions: [
        {
          type: "multiple_choice",
          statement: "A quadratic equation is a polynomial equation of which degree?",
          options: [
            { id: "A", text: "1" },
            { id: "B", text: "2" },
            { id: "C", text: "3" },
            { id: "D", text: "4" },
          ],
          correctAnswer: "B",
          explanation: "The reference states the degree is 2.",
        },
        {
          type: "true_false",
          statement: "Roots of a quadratic equation can be found with the quadratic formula.",
          options: [
            { id: "true", text: "True" },
            { id: "false", text: "False" },
          ],
          correctAnswer: "true",
          explanation: "Explicitly stated in the reference summary.",
        },
      ],
    })
  );
  const { id: userId } = await createTestUser();
  const quizService = await import("../src/server/services/quizService");

  const result = await quizService.create(
    userId,
    quizInput({ sourceMode: "web", topic: "quadratic equations", questionType: "mixed" })
  );
  assert.equal(result.questions.length, 2);
  await ensureDbReady();
  const rows = await getDb()
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, result.quiz.id));
  assert.equal(rows[0].source, "web");
  const metadata = rows[0].sourceMetadata as { provider?: string; sources?: unknown[] };
  assert.equal(metadata.provider, "wikipedia");
  assert.ok(Array.isArray(metadata.sources) && metadata.sources.length > 0, "consulted sources recorded");
});
