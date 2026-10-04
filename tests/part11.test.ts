import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, createTestUser } from "./helpers";
import { loadEnv, setEnvForTesting } from "../src/server/config/env";
import { clearProviders } from "../src/server/providers/registry";
import {
  resetBuiltinProvidersForTesting,
  ensureBuiltinProviders,
} from "../src/server/providers/builtins";
import { registerProvider } from "../src/server/providers/registry";
import { resetCatalogForTesting } from "../src/server/services/modelCatalogService";
import { resetAiCircuitForTesting } from "../src/server/services/aiService";
import { resetQuizCreationLocksForTesting } from "../src/server/services/quizService";
import { resetChatLocksForTesting } from "../src/server/services/chatService";
import { assertSafeRemoteBaseUrl } from "../src/server/services/remoteFetchGuard";
import { readJson } from "../src/server/http/respond";
import { ValidationError } from "../src/server/errors";
import { AIError } from "../src/server/errors";
import type { AIProvider } from "../src/server/providers/types";
import type { QuizCreateInput } from "../src/lib/api/schemas";

/**
 * Part 11 — hardening regression suite.
 *
 * Covers the new defenses added in this phase: AI provider circuit breaker,
 * JSON body size caps, duplicate quiz-generation guard, outbound-fetch SSRF
 * guard, plus a couple of no-secret-leak checks against existing contracts.
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

beforeEach(async () => {
  await freshDatabase();
  clearProviders();
  resetBuiltinProvidersForTesting();
  resetCatalogForTesting();
  resetAiCircuitForTesting();
  resetQuizCreationLocksForTesting();
  resetChatLocksForTesting();
  setEnvForTesting({ ...loadEnv(), OPENROUTER_API_KEY: DUMMY_KEY });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function quizInput(overrides: Partial<QuizCreateInput> = {}): QuizCreateInput {
  return {
    title: "Part 11 quiz",
    subject: "Biology",
    topic: "",
    difficulty: "medium",
    questionType: "multiple-choice",
    academicLevel: "high-school",
    questionCount: 1,
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
      databaseSource: "public-exams",
      institution: "",
      year: "",
      academicLevel: "high-school",
      customInstructions: "",
    },
    ...overrides,
  };
}

/* ---------------- JSON body cap ---------------- */

test("readJson rejects oversized and malformed bodies", async () => {
  const big = new Request("http://localhost/api", {
    method: "POST",
    body: " ".repeat(70_000),
  });
  await assert.rejects(readJson(big), (error: unknown) => error instanceof ValidationError);

  const malformed = new Request("http://localhost/api", { method: "POST", body: "{nope" });
  await assert.rejects(readJson(malformed), ValidationError);

  const okRequest = new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({ a: 1 }),
  });
  assert.deepEqual(await readJson(okRequest), { a: 1 });
});

/* ---------------- Circuit breaker ---------------- */

test("the AI circuit opens after repeated provider failures and fast-fails", async () => {
  let generateCalls = 0;
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => [stubModel("vendor/free")],
    generate: async () => {
      generateCalls += 1;
      throw new AIError("AI_REQUEST_TIMEOUT", "timeout");
    },
    stream: () =>
      (async function* () {
        yield { type: "complete" } as never;
      })(),
    validateConfiguration: async () => ({ ok: true }),
    supports: () => true,
  };
  ensureBuiltinProviders();
  registerProvider(provider);

  const aiService = await import("../src/server/services/aiService");
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(aiService.generate({ messages: [{ role: "user", content: "hi" }] }));
  }
  assert.equal(generateCalls, 5);

  await assert.rejects(
    aiService.generate({ messages: [{ role: "user", content: "hi" }] }),
    (error: unknown) =>
      error instanceof AIError &&
      error.aiCode === "AI_PROVIDER_UNAVAILABLE" &&
      /temporarily unavailable/i.test(error.message)
  );
  // The open circuit short-circuits before touching the provider.
  assert.equal(generateCalls, 5);
});

test("the circuit closes again on the next success after cooldown", async () => {
  let generateCalls = 0;
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => [stubModel("vendor/free")],
    generate: async (request) => {
      generateCalls += 1;
      if (generateCalls <= 5) throw new AIError("AI_REQUEST_TIMEOUT", "timeout");
      return {
        content: "ok",
        model: request.model,
        requestedModel: request.model,
        fallbackUsed: false,
        usage: null,
      };
    },
    stream: () =>
      (async function* () {
        yield { type: "complete" } as never;
      })(),
    validateConfiguration: async () => ({ ok: true }),
    supports: () => true,
  };
  ensureBuiltinProviders();
  registerProvider(provider);

  const aiService = await import("../src/server/services/aiService");
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(aiService.generate({ messages: [{ role: "user", content: "hi" }] }));
  }
  assert.equal(generateCalls, 5);

  // Fast-failing while the circuit is open:
  await assert.rejects(
    aiService.generate({ messages: [{ role: "user", content: "hi" }] }),
    /temporarily unavailable/i
  );
  assert.equal(generateCalls, 5);

  // After cooldown, a successful probe closes the circuit again.
  aiService.expireAiCircuitCooldownForTesting();
  const result = await aiService.generate({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.content, "ok");
  assert.equal(generateCalls, 6);
  const again = await aiService.generate({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(again.content, "ok");
  assert.equal(generateCalls, 7);
});

/* ---------------- Quiz duplicate generation ---------------- */

test("concurrent identical quiz creation is rejected with a conflict", async () => {
  const { id: userId } = await createTestUser();
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => [stubModel("vendor/free")],
    generate: async (request) => {
      // A slow response: the second concurrent request must hit the lock while
      // the first is still generating.
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        content: JSON.stringify({
          questions: [
            {
              type: "multiple_choice",
              statement: "What organelle produces ATP?",
              options: [
                { id: "A", text: "Mitochondrion" },
                { id: "B", text: "Ribosome" },
              ],
              correctAnswer: "A",
              explanation: "Biology.",
            },
          ],
        }),
        model: request.model,
        requestedModel: request.model,
        fallbackUsed: false,
        usage: null,
      };
    },
    stream: () =>
      (async function* () {
        yield { type: "complete" } as never;
      })(),
    validateConfiguration: async () => ({ ok: true }),
    supports: () => true,
  };
  ensureBuiltinProviders();
  registerProvider(provider);

  const quizService = await import("../src/server/services/quizService");
  const first = quizService.create(userId, quizInput());
  const second = quizService.create(userId, quizInput());
  const results = await Promise.allSettled([first, second]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const conflicts = results.filter(
    (r) => r.status === "rejected" && /already being generated/i.test(String(r.reason))
  );
  assert.equal(fulfilled.length, 1);
  assert.equal(conflicts.length, 1);
});

/* ---------------- SSRF guard ---------------- */

test("remote fetch guard refuses private/loopback/non-http targets", () => {
  for (const bad of [
    "http://localhost/admin",
    "http://127.0.0.1/api",
    "http://0.0.0.0",
    "http://10.1.2.3",
    "http://192.168.0.1",
    "http://172.16.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "ftp://example.com",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.throws(() => assertSafeRemoteBaseUrl(bad, "TEST_URL"), Error, bad);
  }

  assert.doesNotThrow(() => assertSafeRemoteBaseUrl("https://en.wikipedia.org", "TEST_URL"));
  assert.doesNotThrow(() => assertSafeRemoteBaseUrl("https://opentdb.com", "TEST_URL"));
});

/* ---------------- Secret/backref hygiene ---------------- */

test(" provider configuration never exposes the submitted credential", async () => {
  const { id: userId } = await createTestUser();
  const providerService = await import("../src/server/services/providerService");
  const configured = await providerService.configure(userId, "openrouter", {
    credential: "sk-or-v1-supersecretvalue-1234567890",
  });
  assert.ok(!JSON.stringify(configured).includes("supersecret"));
  const fetched = await providerService.get(userId, "openrouter");
  assert.ok(!JSON.stringify(fetched).includes("supersecret"));
});
