import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, createTestUser } from "./helpers";
import { loadEnv, setEnvForTesting } from "../src/server/config/env";
import { AIError } from "../src/server/errors";
import { OpenRouterClient } from "../src/server/providers/openrouter/client";
import { OpenRouterProvider } from "../src/server/providers/openrouter/provider";
import { normalizeModel, detectFree } from "../src/server/providers/openrouter/normalize";
import { registerProvider, clearProviders } from "../src/server/providers/registry";
import {
  resetBuiltinProvidersForTesting,
  ensureBuiltinProviders,
} from "../src/server/providers/builtins";
import { resetCatalogForTesting } from "../src/server/services/modelCatalogService";
import type { AIProvider } from "../src/server/providers/types";
import type { AIModel } from "../src/server/providers/types";

/**
 * Part 6 — OpenRouter provider infrastructure.
 *
 * No test touches the network: the HTTP layer is exercised through an injected
 * fetch, and the service layer through a stub provider registered in the same
 * registry the real one uses. The API key used here is a fixed dummy value
 * that must never leak into messages, responses or logs.
 */

const DUMMY_KEY = "sk-or-v1-test-only-dummy-key-not-a-real-credential";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function openRouterModel(overrides: Record<string, unknown> = {}) {
  return {
    id: "vendor/model-a",
    name: "Model A",
    description: "A test model",
    context_length: 128000,
    architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    pricing: { prompt: "0", completion: "0" },
    supported_parameters: ["tools"],
    ...overrides,
  };
}

function normalizedModel(overrides: Partial<AIModel> = {}): AIModel {
  return {
    id: "vendor/model-a",
    provider: "openrouter",
    name: "Model A",
    description: null,
    contextLength: 128000,
    capabilities: {
      text: true,
      vision: false,
      imageInput: false,
      fileInput: false,
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
    },
    pricing: { input: 0, output: 0 },
    isFree: true,
    isAvailable: true,
    ...overrides,
  };
}

/** A fetch stub returning queued responses, recording every call. */
function fetchQueue(...responses: Array<Response | (() => never)>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const queue = [...responses];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = queue.shift();
    if (!next) throw new Error("fetch queue exhausted");
    if (typeof next === "function") return next();
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sseResponse(events: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function makeClient(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new OpenRouterClient({
    apiKey: DUMMY_KEY,
    baseUrl: "https://openrouter.test/api/v1",
    timeoutMs: 1000,
    maxRetries: 2,
    fetchImpl,
    ...overrides,
  } as ConstructorParameters<typeof OpenRouterClient>[0]);
}

/** Registers a stub provider under the real provider id. */
function registerStubProvider(stub: Partial<AIProvider> & { id?: "openrouter" }) {
  const provider: AIProvider = {
    id: "openrouter",
    listModels: async () => [],
    generate: async () => {
      throw new AIError("AI_UNKNOWN_ERROR", "not implemented in stub");
    },
    stream: async function* () {
      yield { type: "complete" };
    },
    validateConfiguration: async () => ({ ok: true }),
    supports: () => true,
    ...stub,
  };
  // Built-ins first, then the stub overrides the same registry slot.
  ensureBuiltinProviders();
  registerProvider(provider);
  return provider;
}

function enableProviderKey(): void {
  setEnvForTesting({ ...loadEnv(), OPENROUTER_API_KEY: DUMMY_KEY });
}

function disableProviderKey(): void {
  setEnvForTesting({ ...loadEnv(), OPENROUTER_API_KEY: undefined });
}

before(() => {
  resetBuiltinProvidersForTesting();
});

beforeEach(() => {
  clearProviders();
  resetBuiltinProvidersForTesting();
  resetCatalogForTesting();
  disableProviderKey();
});

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

test("zero input and output pricing marks a model free", () => {
  assert.deepEqual(detectFree({ prompt: "0", completion: "0" }), {
    isFree: true,
    input: 0,
    output: 0,
  });
});

test("any non-zero price means the model is not free", () => {
  assert.equal(detectFree({ prompt: "0.00000015", completion: "0" }).isFree, false);
  assert.equal(detectFree({ prompt: "0", completion: "0.0000012" }).isFree, false);
});

test("missing pricing is reported as unknown, never as free", () => {
  const result = detectFree(undefined);
  assert.equal(result.isFree, false);
  assert.equal(result.input, null);
  assert.equal(result.output, null);
});

test("a ':free' name suffix alone does not make a model free", () => {
  const model = normalizeModel(
    openRouterModel({
      id: "vendor/great-model:free",
      pricing: { prompt: "0.000002", completion: "0.000002" },
    }) as never
  );
  assert.equal(model.isFree, false, "free status comes from pricing, not naming");
});

test("normalization maps capabilities and context from provider metadata", () => {
  const model = normalizeModel(
    openRouterModel({
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
      supported_parameters: ["tools", "structured_outputs"],
    }) as never
  );
  assert.equal(model.capabilities.vision, true);
  assert.equal(model.capabilities.imageInput, true);
  assert.equal(model.capabilities.fileInput, false);
  assert.equal(model.capabilities.toolCalling, true);
  assert.equal(model.capabilities.structuredOutput, true);
  assert.equal(model.contextLength, 128000);
});

test("missing context length stays null instead of being invented", () => {
  const model = normalizeModel(
    openRouterModel({ context_length: null }) as never
  );
  assert.equal(model.contextLength, null);
});

/* ------------------------------------------------------------------ */
/* Client: error normalization, retries, timeouts                      */
/* ------------------------------------------------------------------ */

test("401 maps to AI_AUTHENTICATION_FAILED and is never retried", async () => {
  const { impl, calls } = fetchQueue(jsonResponse(401, { error: { message: "bad key" } }));
  const client = makeClient(impl);

  await assert.rejects(
    () => client.requestJson("/models", { method: "GET" }, "catalog"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_AUTHENTICATION_FAILED"
  );
  assert.equal(calls.length, 1, "auth failures must not be retried");
});

test("429 maps to AI_RATE_LIMITED with retry timing and is not retried", async () => {
  const { impl, calls } = fetchQueue(
    jsonResponse(429, { error: { message: "slow down" } }, { "retry-after": "17" })
  );
  const client = makeClient(impl);

  await assert.rejects(
    () => client.requestJson("/models", { method: "GET" }, "catalog"),
    (error: unknown) =>
      error instanceof AIError &&
      error.aiCode === "AI_RATE_LIMITED" &&
      error.retryAfterSeconds === 17
  );
  assert.equal(calls.length, 1, "rate-limited requests are not retried aggressively");
});

test("a transient 500 is retried and the second attempt can succeed", async () => {
  const { impl, calls } = fetchQueue(
    jsonResponse(500, { error: { message: "boom" } }),
    jsonResponse(200, { data: [] })
  );
  const client = makeClient(impl, { maxRetries: 2 });

  const result = await client.requestJson("/models", { method: "GET" }, "catalog");
  assert.deepEqual(result, { data: [] });
  assert.equal(calls.length, 2);
});

test("persistent 503 exhausts retries and surfaces AI_PROVIDER_UNAVAILABLE", async () => {
  const { impl, calls } = fetchQueue(
    jsonResponse(503, {}),
    jsonResponse(503, {}),
    jsonResponse(503, {})
  );
  const client = makeClient(impl, { maxRetries: 2 });

  await assert.rejects(
    () => client.requestJson("/models", { method: "GET" }, "catalog"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_PROVIDER_UNAVAILABLE"
  );
  assert.equal(calls.length, 3, "first attempt plus two retries");
});

test("400 maps to AI_INVALID_REQUEST without retries", async () => {
  const { impl, calls } = fetchQueue(jsonResponse(400, { error: { message: "bad" } }));
  const client = makeClient(impl);

  await assert.rejects(
    () =>
      client.requestJson("/chat/completions", { method: "POST", body: {} }, "generation"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_INVALID_REQUEST"
  );
  assert.equal(calls.length, 1);
});

test("a network failure maps to AI_PROVIDER_UNAVAILABLE", async () => {
  const { impl } = fetchQueue(() => {
    throw new TypeError("fetch failed");
  });
  const client = makeClient(impl, { maxRetries: 0 });

  await assert.rejects(
    () => client.requestJson("/models", { method: "GET" }, "catalog"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_PROVIDER_UNAVAILABLE"
  );
});

test("a malformed JSON body maps to AI_CONTENT_ERROR", async () => {
  const broken = new Response("not json", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const { impl } = fetchQueue(broken);
  const client = makeClient(impl, { maxRetries: 0 });

  await assert.rejects(
    () => client.requestJson("/models", { method: "GET" }, "catalog"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_CONTENT_ERROR"
  );
});

test("a hung request becomes AI_REQUEST_TIMEOUT", async () => {
  const impl = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init?.signal?.reason), {
        once: true,
      });
    })) as unknown as typeof fetch;
  const client = makeClient(impl, { timeoutMs: 30, maxRetries: 0 });

  await assert.rejects(
    () => client.requestJson("/models", { method: "GET" }, "catalog"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_REQUEST_TIMEOUT"
  );
});

test("the API key is sent upstream but never appears in errors or logs", async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (line: unknown) => warnings.push(String(line));
  try {
    const { impl, calls } = fetchQueue(
      jsonResponse(401, { error: { message: `key ${DUMMY_KEY} was rejected` } })
    );
    const client = makeClient(impl, { maxRetries: 0 });

    await assert.rejects(
      () => client.requestJson("/models", { method: "GET" }, "catalog"),
      (error: unknown) => {
        assert.ok(error instanceof AIError);
        assert.ok(!error.message.includes(DUMMY_KEY), "error message must not leak the key");
        return true;
      }
    );

    const auth = String(calls[0]?.init?.headers?.["Authorization" as never] ?? "");
    assert.equal(auth, `Bearer ${DUMMY_KEY}`, "the key authenticates the upstream call");
    assert.ok(
      warnings.every((line) => !line.includes(DUMMY_KEY)),
      "provider messages echoing the key are redacted before logging"
    );
  } finally {
    console.warn = originalWarn;
  }
});

/* ------------------------------------------------------------------ */
/* Provider: catalog validation and streaming                          */
/* ------------------------------------------------------------------ */

test("a malformed catalog payload becomes AI_CONTENT_ERROR", async () => {
  const { impl } = fetchQueue(jsonResponse(200, { unexpected: true }));
  const provider = new OpenRouterProvider(() => makeClient(impl, { maxRetries: 0 }));

  await assert.rejects(
    () => provider.listModels(),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_CONTENT_ERROR"
  );
});

test("catalog entries are normalized and free models detected dynamically", async () => {
  const { impl } = fetchQueue(
    jsonResponse(200, {
      data: [
        openRouterModel({ id: "vendor/free", pricing: { prompt: "0", completion: "0" } }),
        openRouterModel({
          id: "vendor/paid",
          pricing: { prompt: "0.000001", completion: "0.000001" },
        }),
      ],
    })
  );
  const provider = new OpenRouterProvider(() => makeClient(impl, { maxRetries: 0 }));

  const models = await provider.listModels();
  assert.equal(models.length, 2);
  assert.equal(models.find((m) => m.id === "vendor/free")?.isFree, true);
  assert.equal(models.find((m) => m.id === "vendor/paid")?.isFree, false);
});

test("streaming yields normalized events in order", async () => {
  const { impl } = fetchQueue(
    sseResponse([
      `data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":" world"}}]}\n\n`,
      `data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n`,
      `data: [DONE]\n\n`,
    ])
  );
  const provider = new OpenRouterProvider(() => makeClient(impl, { maxRetries: 0 }));

  const events = [];
  for await (const event of provider.stream({
    model: "vendor/free",
    messages: [{ role: "user", content: "hi" }],
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "delta", "delta", "usage", "complete"]
  );
  assert.equal(events[1].type === "delta" && events[1].content, "Hello");
  assert.equal(events[2].type === "delta" && events[2].content, " world");
  assert.deepEqual(events[3].type === "usage" && events[3].usage, {
    promptTokens: 3,
    completionTokens: 2,
    totalTokens: 5,
  });
});

test("a mid-stream provider error becomes an error event and closes the stream", async () => {
  const { impl } = fetchQueue(
    sseResponse([
      `data: {"choices":[{"delta":{"content":"partial"}}]}\n\n`,
      `data: {"error":{"message":"upstream broke","code":502}}\n\n`,
    ])
  );
  const provider = new OpenRouterProvider(() => makeClient(impl, { maxRetries: 0 }));

  const events = [];
  for await (const event of provider.stream({
    model: "vendor/free",
    messages: [{ role: "user", content: "hi" }],
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "delta", "error"],
    "an error event terminates the stream without a complete event"
  );
});

test("cancelling the caller aborts the upstream stream", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start() {},
    cancel() {
      cancelled = true;
    },
  });
  const impl = (async () => new Response(stream, { status: 200 })) as unknown as typeof fetch;
  const provider = new OpenRouterProvider(() => makeClient(impl, { maxRetries: 0 }));

  const controller = new AbortController();
  const iterator = provider
    .stream({ model: "vendor/free", messages: [{ role: "user", content: "hi" }] }, {
      signal: controller.signal,
    })
    [Symbol.asyncIterator]();

  await iterator.next(); // the start event
  const pending = iterator.next(); // enters the stream and awaits upstream bytes
  controller.abort();
  // Cancellation resolves the pending read; the generator then ends the stream.
  await pending;
  assert.equal(cancelled, true, "the upstream reader must be cancelled");
});

/* ------------------------------------------------------------------ */
/* Catalog service: caching, filtering, stale policy, fallback         */
/* ------------------------------------------------------------------ */

test("catalog filters apply and free models sort first", async () => {
  enableProviderKey();
  registerStubProvider({
    listModels: async () => [
      normalizedModel({ id: "vendor/paid", isFree: false, contextLength: 200000 }),
      normalizedModel({ id: "vendor/free-small", isFree: true, contextLength: 32000 }),
      normalizedModel({ id: "vendor/free-big", isFree: true, contextLength: 128000 }),
      normalizedModel({
        id: "vendor/free-vision",
        isFree: true,
        contextLength: 64000,
        capabilities: { ...normalizedModel().capabilities, vision: true },
      }),
    ],
  });

  const { listModels } = await import("../src/server/services/modelCatalogService");

  const all = await listModels();
  assert.deepEqual(
    all.models.map((m) => m.id),
    ["vendor/free-big", "vendor/free-vision", "vendor/free-small", "vendor/paid"],
    "free first, then context length, then name"
  );

  const freeOnly = await listModels({ freeOnly: true });
  assert.equal(freeOnly.models.every((m) => m.isFree), true);

  const vision = await listModels({ freeOnly: true, vision: true });
  assert.deepEqual(vision.models.map((m) => m.id), ["vendor/free-vision"]);

  const bigContext = await listModels({ minContext: 100000 });
  assert.deepEqual(
    bigContext.models.map((m) => m.id),
    ["vendor/free-big", "vendor/paid"]
  );
});

test("a failed refresh serves the previous catalog marked stale", async () => {
  enableProviderKey();
  let fail = false;
  registerStubProvider({
    listModels: async () => {
      if (fail) throw new AIError("AI_PROVIDER_UNAVAILABLE", "down");
      return [normalizedModel({ id: "vendor/free" })];
    },
  });

  const service = await import("../src/server/services/modelCatalogService");
  const fresh = await service.listModels();
  assert.equal(fresh.stale, false);

  fail = true;
  const stale = await service.listModels({}, { refresh: true });
  assert.equal(stale.stale, true, "the previous snapshot is marked stale");
  assert.deepEqual(stale.models.map((m) => m.id), ["vendor/free"]);
});

test("with no cache and a failing provider there is no invented catalog", async () => {
  enableProviderKey();
  registerStubProvider({
    listModels: async () => {
      throw new AIError("AI_PROVIDER_UNAVAILABLE", "down");
    },
  });

  const service = await import("../src/server/services/modelCatalogService");
  await assert.rejects(
    () => service.listModels(),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_PROVIDER_UNAVAILABLE"
  );
});

test("without a configured key the catalog reports not-configured, not fake models", async () => {
  disableProviderKey();
  registerStubProvider({});

  const service = await import("../src/server/services/modelCatalogService");
  await assert.rejects(
    () => service.listModels(),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_PROVIDER_UNAVAILABLE"
  );
});

test("model resolution falls back transparently and records it", async () => {
  enableProviderKey();
  registerStubProvider({
    listModels: async () => [
      normalizedModel({ id: "vendor/requested" }),
      normalizedModel({ id: "vendor/user-fallback" }),
      normalizedModel({ id: "vendor/free-first" }),
    ],
  });

  const service = await import("../src/server/services/modelCatalogService");

  const direct = await service.resolveModel({ requestedModelId: "vendor/requested" });
  assert.deepEqual(
    { id: direct.model.id, used: direct.fallbackUsed },
    { id: "vendor/requested", used: false }
  );

  const userFallback = await service.resolveModel({
    requestedModelId: "vendor/gone",
    userFallbackModelId: "vendor/user-fallback",
  });
  assert.deepEqual(
    { id: userFallback.model.id, used: userFallback.fallbackUsed },
    { id: "vendor/user-fallback", used: true }
  );

  const automatic = await service.resolveModel({ requestedModelId: "vendor/gone" });
  assert.equal(automatic.model.isFree, true, "automatic selection prefers free models");
  assert.equal(automatic.fallbackUsed, true);
});

test("fallback respects required capabilities", async () => {
  enableProviderKey();
  registerStubProvider({
    listModels: async () => [
      normalizedModel({ id: "vendor/free-text-only" }),
      normalizedModel({
        id: "vendor/free-vision",
        capabilities: { ...normalizedModel().capabilities, vision: true },
      }),
    ],
  });

  const service = await import("../src/server/services/modelCatalogService");
  const resolution = await service.resolveModel({
    requestedModelId: null,
    requirements: { vision: true },
  });
  assert.equal(
    resolution.model.id,
    "vendor/free-vision",
    "a model without the required capability must not be selected"
  );
});

test("assertModelUsable rejects unknown and unavailable models", async () => {
  enableProviderKey();
  registerStubProvider({
    listModels: async () => [normalizedModel({ id: "vendor/live" })],
  });

  const service = await import("../src/server/services/modelCatalogService");
  await assert.rejects(
    () => service.assertModelUsable("vendor/gone"),
    (error: unknown) => error instanceof AIError && error.aiCode === "AI_MODEL_UNAVAILABLE"
  );
  const model = await service.assertModelUsable("vendor/live");
  assert.equal(model.id, "vendor/live");
});

/* ------------------------------------------------------------------ */
/* Settings: backend validation of model preferences                   */
/* ------------------------------------------------------------------ */

test("a valid model preference persists; an invalid one is rejected", async () => {
  await freshDatabase();
  enableProviderKey();
  registerStubProvider({
    listModels: async () => [normalizedModel({ id: "vendor/live" })],
  });

  const { id } = await createTestUser();
  const settingsService = await import("../src/server/services/settingsService");

  const updated = await settingsService.patchSettings(id, {
    ai: { defaultModelId: "vendor/live" } as never,
  });
  assert.equal(updated.ai.defaultModelId, "vendor/live");

  await assert.rejects(
    () =>
      settingsService.patchSettings(id, {
        ai: { defaultModelId: "vendor/invented" } as never,
      }),
    (error: unknown) => {
      const appError = error as { code?: string; details?: Record<string, string[]> };
      assert.equal(appError.code, "VALIDATION_ERROR");
      assert.ok(
        appError.details?.["ai.defaultModelId"]?.length,
        "the failing field is identified"
      );
      return true;
    }
  );

  // Automatic selection is always allowed and needs no catalog entry.
  const automatic = await settingsService.patchSettings(id, {
    ai: { defaultModelId: "" } as never,
  });
  assert.equal(automatic.ai.defaultModelId, "");
});

/* ------------------------------------------------------------------ */
/* AIService: generation fallback is transparent                       */
/* ------------------------------------------------------------------ */

test("generation falls back once when the resolved model dies mid-flight", async () => {
  enableProviderKey();
  registerStubProvider({
    listModels: async () => [
      normalizedModel({ id: "vendor/requested" }),
      normalizedModel({ id: "vendor/backup" }),
    ],
    generate: async (request) => {
      if (request.model === "vendor/requested") {
        throw new AIError("AI_MODEL_UNAVAILABLE", "gone");
      }
      return {
        content: "real provider output",
        model: request.model,
        requestedModel: request.model,
        fallbackUsed: false,
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      };
    },
  });

  const { generate } = await import("../src/server/services/aiService");
  const result = await generate({
    requestedModelId: "vendor/requested",
    messages: [{ role: "user", content: "hello" }],
  });

  assert.equal(result.model, "vendor/backup");
  assert.equal(result.requestedModel, "vendor/requested");
  assert.equal(result.fallbackUsed, true, "fallback is recorded, never hidden");
  assert.equal(result.content, "real provider output");
});
