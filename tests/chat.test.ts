import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, createTestUser } from "./helpers";
import { loadEnv, setEnvForTesting } from "../src/server/config/env";
import { AIError } from "../src/server/errors";
import { registerProvider, clearProviders } from "../src/server/providers/registry";
import {
  resetBuiltinProvidersForTesting,
  ensureBuiltinProviders,
} from "../src/server/providers/builtins";
import { resetCatalogForTesting } from "../src/server/services/modelCatalogService";
import { resetChatLocksForTesting } from "../src/server/services/chatService";
import type { AIProvider, AIStreamEvent } from "../src/server/providers/types";
import type { ChatStreamEvent } from "../src/lib/api/contracts";

/**
 * Part 7 — real chat turns.
 *
 * The provider is a stub registered through the same registry OpenRouter uses,
 * so the entire turn (persistence, idempotency, context, streaming, failure
 * and cancellation) is exercised without touching the network.
 */

const DUMMY_KEY = "sk-or-v1-test-only-dummy-key-not-a-real-credential";

type StubBehavior = {
  models?: Awaited<ReturnType<AIProvider["listModels"]>>;
  onStream?: (
    request: Parameters<AIProvider["stream"]>[0],
    options?: { signal?: AbortSignal }
  ) => AsyncIterable<AIStreamEvent>;
};

function stubModel(id: string, contextLength = 128000) {
  return {
    id,
    provider: "openrouter" as const,
    name: id,
    description: null,
    contextLength,
    capabilities: {
      text: true,
      vision: false,
      imageInput: false,
      fileInput: false,
      streaming: true,
      toolCalling: false,
      structuredOutput: false,
    },
    pricing: { input: 0, output: 0 },
    isFree: true,
    isAvailable: true,
  };
}

/** Hangs until the signal aborts, even if it aborted before this call. */
function waitForAbort(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    const onAbort = () => reject(new DOMException("aborted", "AbortError"));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function registerStub(behavior: StubBehavior & { id?: "openrouter" } = {}) {
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => behavior.models ?? [stubModel("vendor/free")],
    generate: async () => {
      throw new AIError("AI_UNKNOWN_ERROR", "generate not implemented in stub");
    },
    stream: (request, options) =>
      behavior.onStream
        ? behavior.onStream(request, options)
        : (async function* (): AsyncIterable<AIStreamEvent> {
            yield {
              type: "start",
              model: request.model,
              requestedModel: request.model,
              fallbackUsed: false,
            };
            yield { type: "delta", content: "Hello" };
            yield { type: "delta", content: " world" };
            yield {
              type: "usage",
              usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
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
  resetChatLocksForTesting();
  setEnvForTesting({ ...loadEnv(), OPENROUTER_API_KEY: DUMMY_KEY });
});

async function setup() {
  const { id: userId } = await createTestUser();
  const conversationService = await import("../src/server/services/conversationService");
  const conversation = await conversationService.create(userId, {
    title: undefined,
    model: null,
  });
  const { runChatTurn } = await import("../src/server/services/chatService");
  return { userId, conversation, runChatTurn };
}

async function drain(turn: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of turn) events.push(event);
  return events;
}

async function messageRows(conversationId: string) {
  const { listMessages } = await import("../src/server/repositories/conversationRepository");
  const page = await listMessages({ conversationId, limit: 100 });
  return [...page.items].reverse();
}

test("a full turn streams, persists both messages and titles the conversation", async () => {
  registerStub();
  const { userId, conversation, runChatTurn } = await setup();

  const events = await drain(
    runChatTurn({
      userId,
      conversationId: conversation.id,
      input: { content: "Explain photosynthesis in simple terms", clientRequestId: crypto.randomUUID() },
    })
  );

  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "delta", "delta", "usage", "complete"]
  );

  const complete = events.at(-1);
  assert.equal(complete?.type, "complete");
  if (complete?.type !== "complete") return;

  assert.equal(complete.assistantMessage.content, "Hello world");
  assert.equal(complete.assistantMessage.metadata?.status, "completed");
  assert.equal(complete.assistantMessage.metadata?.model, "vendor/free");
  assert.equal(complete.assistantMessage.metadata?.fallbackUsed, false);
  assert.deepEqual(complete.assistantMessage.metadata?.tokens, { prompt: 5, completion: 2 });
  assert.ok(
    complete.conversation.title.startsWith("Explain photosynthesis"),
    "title derived from the first message"
  );

  const rows = await messageRows(conversation.id);
  assert.equal(rows.length, 2, "one user message and one assistant message");
  assert.equal(rows[0].role, "user");
  assert.equal(rows[1].role, "assistant");
});

test("empty and whitespace messages are rejected and nothing is persisted", async () => {
  const { userId, conversation, runChatTurn } = await setup();

  await assert.rejects(
    () =>
      drain(
        runChatTurn({
          userId,
          conversationId: conversation.id,
          input: { content: "   " },
        })
      ),
    (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR"
  );

  const rows = await messageRows(conversation.id);
  assert.equal(rows.length, 0);
});

test("an oversized message is rejected by the server-side cap", async () => {
  const { userId, conversation, runChatTurn } = await setup();

  await assert.rejects(
    () =>
      drain(
        runChatTurn({
          userId,
          conversationId: conversation.id,
          input: { content: "x".repeat(8001) },
        })
      ),
    (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR"
  );
});

test("a turn in another user's conversation is not found", async () => {
  const { conversation, runChatTurn } = await setup();
  const { id: otherUserId } = await createTestUser();

  await assert.rejects(
    () =>
      drain(
        runChatTurn({
          userId: otherUserId,
          conversationId: conversation.id,
          input: { content: "hello" },
        })
      ),
    (error: unknown) => (error as { code?: string }).code === "NOT_FOUND"
  );
});

test("provider failure before any output preserves the user message only", async () => {
  registerStub({
    onStream: async function* () {
      throw new AIError("AI_PROVIDER_UNAVAILABLE", "down");
    },
  });
  const { userId, conversation, runChatTurn } = await setup();

  const events = await drain(
    runChatTurn({
      userId,
      conversationId: conversation.id,
      input: { content: "hello", clientRequestId: crypto.randomUUID() },
    })
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "error");
  if (events[0].type !== "error") return;
  assert.equal(events[0].code, "AI_PROVIDER_UNAVAILABLE");
  assert.ok(events[0].userMessage, "the persisted user message is reported back");
  assert.equal(events[0].assistantMessage, null);

  const rows = await messageRows(conversation.id);
  assert.equal(rows.length, 1, "the user message survives the provider failure");
  assert.equal(rows[0].role, "user");
});

test("a mid-stream failure persists a clearly marked partial answer", async () => {
  registerStub({
    onStream: async function* () {
      yield { type: "start", model: "vendor/free", requestedModel: "vendor/free", fallbackUsed: false };
      yield { type: "delta", content: "Photosynthesis is the process by which" };
      yield { type: "error", code: "AI_PROVIDER_UNAVAILABLE", message: "upstream broke" };
    },
  });
  const { userId, conversation, runChatTurn } = await setup();

  const events = await drain(
    runChatTurn({
      userId,
      conversationId: conversation.id,
      input: { content: "explain photosynthesis", clientRequestId: crypto.randomUUID() },
    })
  );

  const last = events.at(-1);
  assert.equal(last?.type, "error");
  if (last?.type !== "error") return;
  assert.equal(last.assistantMessage?.metadata?.status, "failed");
  assert.equal(last.assistantMessage?.metadata?.partial, true);
  assert.equal(last.assistantMessage?.content, "Photosynthesis is the process by which");

  const rows = await messageRows(conversation.id);
  const assistant = rows.find((row) => row.role === "assistant");
  assert.ok(assistant, "the partial is persisted");
  assert.equal(assistant.metadata?.status, "failed");
});

test("a retried send with the same clientRequestId never duplicates the turn", async () => {
  let generations = 0;
  registerStub({
    onStream: async function* () {
      generations += 1;
      yield { type: "start", model: "vendor/free", requestedModel: "vendor/free", fallbackUsed: false };
      yield { type: "delta", content: "answer" };
      yield { type: "complete" };
    },
  });
  const { userId, conversation, runChatTurn } = await setup();
  const clientRequestId = crypto.randomUUID();

  const first = await drain(
    runChatTurn({ userId, conversationId: conversation.id, input: { content: "hi", clientRequestId } })
  );
  assert.equal(first.at(-1)?.type, "complete");

  const second = await drain(
    runChatTurn({ userId, conversationId: conversation.id, input: { content: "hi", clientRequestId } })
  );
  assert.deepEqual(
    second.map((event) => event.type),
    ["complete"],
    "a duplicate send replays the stored result"
  );

  assert.equal(generations, 1, "the provider ran exactly once");
  const rows = await messageRows(conversation.id);
  assert.equal(rows.filter((row) => row.role === "user").length, 1);
  assert.equal(rows.filter((row) => row.role === "assistant").length, 1);
});

test("retrying a failed turn replaces the partial with a completed answer", async () => {
  let attempt = 0;
  registerStub({
    onStream: async function* () {
      attempt += 1;
      yield { type: "start", model: "vendor/free", requestedModel: "vendor/free", fallbackUsed: false };
      if (attempt === 1) {
        yield { type: "delta", content: "partial" };
        yield { type: "error", code: "AI_PROVIDER_UNAVAILABLE", message: "broke" };
      } else {
        yield { type: "delta", content: "full answer" };
        yield { type: "complete" };
      }
    },
  });
  const { userId, conversation, runChatTurn } = await setup();
  const clientRequestId = crypto.randomUUID();

  const failed = await drain(
    runChatTurn({ userId, conversationId: conversation.id, input: { content: "hi", clientRequestId } })
  );
  assert.equal(failed.at(-1)?.type, "error");

  const retried = await drain(
    runChatTurn({ userId, conversationId: conversation.id, input: { content: "hi", clientRequestId } })
  );
  assert.equal(retried.at(-1)?.type, "complete");

  const rows = await messageRows(conversation.id);
  assert.equal(rows.filter((row) => row.role === "user").length, 1, "user message not duplicated");
  const assistants = rows.filter((row) => row.role === "assistant");
  assert.equal(assistants.length, 1, "the failed partial was replaced");
  assert.equal(assistants[0].content, "full answer");
  assert.equal(assistants[0].metadata?.status, "completed");
});

test("a second generation in the same conversation is refused while one runs", async () => {
  registerStub({
    onStream: async function* (_request, options) {
      yield { type: "start", model: "vendor/free", requestedModel: "vendor/free", fallbackUsed: false };
      // Stays active until the test aborts it.
      await waitForAbort(options?.signal);
    },
  });
  const { userId, conversation, runChatTurn } = await setup();

  const controller = new AbortController();
  const firstTurn = runChatTurn({
    userId,
    conversationId: conversation.id,
    input: { content: "first" },
    signal: controller.signal,
  })[Symbol.asyncIterator]();
  await firstTurn.next(); // locks the conversation

  await assert.rejects(
    () =>
      drain(
        runChatTurn({
          userId,
          conversationId: conversation.id,
          input: { content: "second" },
        })
      ),
    (error: unknown) => (error as { code?: string }).code === "CONFLICT"
  );

  controller.abort();
  // Drain the first turn so its lock releases before the next test.
  for (;;) {
    const next = await firstTurn.next();
    if (next.done) break;
  }
});

test("cancelling mid-stream persists a cancelled partial, never a false success", async () => {
  registerStub({
    onStream: async function* (_request, options) {
      yield { type: "start", model: "vendor/free", requestedModel: "vendor/free", fallbackUsed: false };
      yield { type: "delta", content: "partial answer" };
      await waitForAbort(options?.signal);
    },
  });
  const { userId, conversation, runChatTurn } = await setup();

  const controller = new AbortController();
  const events: ChatStreamEvent[] = [];
  const turn = runChatTurn({
    userId,
    conversationId: conversation.id,
    input: { content: "hi" },
    signal: controller.signal,
  });

  for await (const event of turn) {
    events.push(event);
    if (event.type === "delta") controller.abort();
  }

  const last = events.at(-1);
  assert.equal(last?.type, "error");
  const rows = await messageRows(conversation.id);
  const assistant = rows.find((row) => row.role === "assistant");
  assert.ok(assistant, "the partial was persisted");
  assert.equal(assistant.metadata?.status, "cancelled");
  assert.equal(assistant.metadata?.partial, true);
  assert.equal(assistant.content, "partial answer");
});

test("context selection keeps the newest messages within the token budget", async () => {
  const { selectContext } = await import("../src/server/services/chatService");

  const history = Array.from({ length: 30 }, (_, index) => ({
    role: "user" as const,
    content: `message ${index} ${"x".repeat(200)}`,
  }));

  const selected = selectContext({
    systemPrompt: "system",
    history,
    tokenBudget: 500,
  });

  assert.equal(selected[0].role, "system");
  assert.ok(selected.length < history.length + 1, "older turns were dropped");
  assert.equal(
    selected.at(-1)?.content,
    history.at(-1)?.content,
    "the newest message is always kept"
  );
  assert.equal(selected[1]?.content, history.at(-selected.length + 1)?.content);
});

test("a single message larger than the budget is reported as context too large", async () => {
  const { selectContext } = await import("../src/server/services/chatService");

  assert.throws(
    () =>
      selectContext({
        systemPrompt: "system",
        history: [{ role: "user", content: "x".repeat(100_000) }],
        tokenBudget: 1000,
      }),
    (error: unknown) =>
      error instanceof AIError && error.aiCode === "AI_CONTEXT_TOO_LARGE"
  );
});

test("the conversation model is used; a per-request override wins", async () => {
  const seen: string[] = [];
  registerStub({
    models: [stubModel("vendor/free"), stubModel("vendor/other")],
    onStream: async function* (request) {
      seen.push(request.model);
      yield { type: "start", model: request.model, requestedModel: request.model, fallbackUsed: false };
      yield { type: "delta", content: "ok" };
      yield { type: "complete" };
    },
  });
  const { userId, conversation, runChatTurn } = await setup();
  const conversationService = await import("../src/server/services/conversationService");
  await conversationService.update(userId, conversation.id, { model: "vendor/other" });

  await drain(
    runChatTurn({ userId, conversationId: conversation.id, input: { content: "one" } })
  );
  await drain(
    runChatTurn({
      userId,
      conversationId: conversation.id,
      input: { content: "two", model: "vendor/free" },
    })
  );

  assert.deepEqual(seen, ["vendor/other", "vendor/free"]);

  const rows = await messageRows(conversation.id);
  const models = rows.filter((r) => r.role === "assistant").map((r) => r.metadata?.model);
  assert.deepEqual(models, ["vendor/other", "vendor/free"], "each reply records its model");
});

test("the non-streaming preference produces the same persisted result", async () => {
  const provider = registerStub({
    onStream: async function* () {
      throw new AIError("AI_UNKNOWN_ERROR", "stream must not be called");
    },
  });
  provider.generate = async (request) => ({
    content: "buffered answer",
    model: request.model,
    requestedModel: request.model,
    fallbackUsed: false,
    usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
  });

  const { userId, conversation, runChatTurn } = await setup();
  const settingsService = await import("../src/server/services/settingsService");
  const current = await settingsService.getSettings(userId);
  await settingsService.patchSettings(userId, {
    ai: { ...current.ai, streaming: false },
  });

  const events = await drain(
    runChatTurn({ userId, conversationId: conversation.id, input: { content: "hi" } })
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "delta", "usage", "complete"]
  );
  const rows = await messageRows(conversation.id);
  assert.equal(rows.find((row) => row.role === "assistant")?.content, "buffered answer");
});

test("titles are derived deterministically and safely", async () => {
  const { deriveTitle } = await import("../src/lib/titles");

  assert.equal(deriveTitle(""), "New conversation");
  assert.equal(deriveTitle("   "), "New conversation");
  assert.equal(deriveTitle("explain gravity"), "Explain gravity");
  assert.equal(
    deriveTitle("**what** is `photosynthesis`?"),
    "What is photosynthesis?"
  );
  const long = deriveTitle(
    "please explain in great detail how the mitochondria produces energy for the cell through cellular respiration"
  );
  assert.ok(long.length <= 61, "titles are truncated");
  assert.ok(long.endsWith("…"));
  assert.ok(!/\s…$/.test(long) === false || long.endsWith("…"));
});
