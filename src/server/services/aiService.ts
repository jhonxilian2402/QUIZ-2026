import { AIError } from "../errors";
import { logger } from "../logger";
import { getProvider } from "../providers/registry";
import { ensureBuiltinProviders } from "../providers/builtins";
import { resolveModel } from "./modelCatalogService";
import type {
  AICapability,
  AIGenerationRequest,
  AIGenerationResult,
  AIStreamEvent,
  ProviderHealth,
} from "../providers/types";

/**
 * AI service boundary.
 *
 * The only place the application asks for generated content. It resolves the
 * model through the catalog (with transparent fallback), delegates to the
 * registered provider and normalizes the outcome. Route handlers and the
 * frontend never know which vendor answered, how credentials are handled, or
 * how retries work.
 */

export class AINotConnectedError extends AIError {
  constructor() {
    super(
      "AI_PROVIDER_UNAVAILABLE",
      "AI generation is not connected yet. A provider will be configured in a later phase."
    );
  }
}

export type AIGenerationOptions = {
  /** "" / undefined = automatic selection through the fallback chain. */
  requestedModelId?: string | null;
  userFallbackModelId?: string | null;
  preferFree?: boolean;
  requirements?: Partial<Record<AICapability, true>>;
  messages: AIGenerationRequest["messages"];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: AIGenerationRequest["responseFormat"];
  signal?: AbortSignal;
  requestId?: string;
};

function providerOrThrow() {
  ensureBuiltinProviders();
  const provider = getProvider("openrouter");
  if (!provider) throw new AINotConnectedError();
  return provider;
}

function isModelUnavailable(error: unknown): boolean {
  return error instanceof AIError && error.aiCode === "AI_MODEL_UNAVAILABLE";
}

/* ---------------- Provider circuit breaker ----------------
   Repeated provider failures trip an open circuit so a flood of requests
   cannot pile up against a dead provider. The circuit half-closes after a
   cooldown and fully closes on the next success. AI calls are expensive, so
   this is observability AND cost protection. */

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_FAILURE_WINDOW_MS = 60_000;
const CIRCUIT_COOLDOWN_MS = 30_000;

type CircuitState = {
  failures: number[];
  openedUntil: number | null;
};

const globalForCircuit = globalThis as typeof globalThis & {
  __quizAiCircuit?: CircuitState;
};

function circuit(): CircuitState {
  globalForCircuit.__quizAiCircuit ??= { failures: [], openedUntil: null };
  return globalForCircuit.__quizAiCircuit;
}

/** Test hook: resets the breaker between test cases. */
export function resetAiCircuitForTesting(): void {
  globalForCircuit.__quizAiCircuit = undefined;
}

/** Test hook: forces the cooldown to elapse so a probe request can pass. */
export function expireAiCircuitCooldownForTesting(): void {
  const state = circuit();
  if (state.openedUntil !== null) state.openedUntil = Date.now() - 1;
}

function assertCircuitClosed(): void {
  const state = circuit();
  if (state.openedUntil !== null) {
    if (Date.now() < state.openedUntil) {
      throw new AIError(
        "AI_PROVIDER_UNAVAILABLE",
        "The AI provider is temporarily unavailable. Please try again shortly."
      );
    }
    // Cooldown elapsed: allow one probe request through.
    state.openedUntil = null;
    state.failures = [];
  }
}

function recordProviderSuccess(): void {
  const state = circuit();
  state.failures = [];
  state.openedUntil = null;
}

function recordProviderFailure(error: unknown): void {
  // Deterministic, non-transient errors (bad input, auth) must not trip the
  // breaker: only network/timeout/provider/5xx/429 failures indicate outage.
  const retryable =
    error instanceof AIError &&
    (error.aiCode === "AI_REQUEST_TIMEOUT" ||
      error.aiCode === "AI_PROVIDER_UNAVAILABLE" ||
      error.aiCode === "AI_RATE_LIMITED" ||
      error.aiCode === "AI_UNKNOWN_ERROR");
  if (!retryable) return;

  const state = circuit();
  const now = Date.now();
  state.failures = state.failures.filter((at) => now - at < CIRCUIT_FAILURE_WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= CIRCUIT_FAILURE_THRESHOLD) {
    state.openedUntil = now + CIRCUIT_COOLDOWN_MS;
    state.failures = [];
    logger.warn("AI circuit opened after repeated provider failures", {
      provider: "openrouter",
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    });
  }
}

/**
 * Generates a completion. If the resolved model fails with a model-level
 * unavailability, exactly one fallback attempt is made with the next
 * compatible model; the result always records which model actually answered.
 */
export async function generate(options: AIGenerationOptions): Promise<AIGenerationResult> {
  assertCircuitClosed();
  const provider = providerOrThrow();
  const resolution = await resolveModel({
    requestedModelId: options.requestedModelId,
    userFallbackModelId: options.userFallbackModelId,
    requirements: options.requirements,
    preferFree: options.preferFree,
  });

  const request: AIGenerationRequest = {
    model: resolution.model.id,
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    responseFormat: options.responseFormat,
  };

  try {
    const result = await provider.generate(request, { signal: options.signal });
    recordProviderSuccess();
    return {
      ...result,
      requestedModel: resolution.requestedModel,
      fallbackUsed: resolution.fallbackUsed,
    };
  } catch (error) {
    if (!isModelUnavailable(error)) {
      recordProviderFailure(error);
      throw error;
    }

    // The model disappeared between resolution and generation: one retry
    // through the fallback chain, excluding the model that just failed.
    const fallback = await resolveModel({
      requestedModelId: null,
      userFallbackModelId: options.userFallbackModelId,
      requirements: options.requirements,
      preferFree: options.preferFree,
      excludeModelIds: [resolution.model.id],
    });
    if (fallback.model.id === resolution.model.id) throw error;

    logger.warn("AI generation fell back after model failure", {
      provider: provider.id,
      requestedModel: resolution.model.id,
      fallbackModel: fallback.model.id,
      requestId: options.requestId,
    });

    try {
      const result = await provider.generate(
        { ...request, model: fallback.model.id },
        { signal: options.signal }
      );
      recordProviderSuccess();
      return { ...result, requestedModel: resolution.requestedModel, fallbackUsed: true };
    } catch (fallbackError) {
      recordProviderFailure(fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Streams a completion as normalized events. The `start` event always carries
 * the actual and requested model so downstream consumers can display fallback
 * honestly. Cancellation propagates upstream through `signal`.
 */
export async function* stream(options: AIGenerationOptions): AsyncIterable<AIStreamEvent> {
  assertCircuitClosed();
  const provider = providerOrThrow();
  const resolution = await resolveModel({
    requestedModelId: options.requestedModelId,
    userFallbackModelId: options.userFallbackModelId,
    requirements: options.requirements,
    preferFree: options.preferFree,
  });

  let started = false;
  let failed = false;
  try {
    for await (const event of provider.stream(
      {
        model: resolution.model.id,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      },
      { signal: options.signal }
    )) {
      if (event.type === "start") {
        started = true;
        yield {
          ...event,
          model: resolution.model.id,
          requestedModel: resolution.requestedModel,
          fallbackUsed: resolution.fallbackUsed,
        };
        continue;
      }
      if (event.type === "error") {
        failed = true;
        recordProviderFailure(
          new AIError(
            (event.code as AIError["aiCode"]) ?? "AI_UNKNOWN_ERROR",
            event.message ?? "Provider error"
          )
        );
      }
      yield event;
    }
  } catch (error) {
    failed = true;
    recordProviderFailure(error);
    throw error;
  }
  if (!failed) recordProviderSuccess();

  if (!started) {
    // A provider that fails before its first event surfaces that failure
    // directly; this guard only documents the invariant.
    return;
  }
}

/** Cheap health probe for the registered provider. Never throws. */
export async function validateProvider(): Promise<ProviderHealth> {
  try {
    return await providerOrThrow().validateConfiguration();
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The provider is unavailable.",
    };
  }
}
