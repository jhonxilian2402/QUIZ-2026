import type { AIModelCapabilities, ProviderId } from "@/lib/api/contracts";

/**
 * Provider abstraction.
 *
 * The application depends on these normalized types, never on a vendor payload.
 * OpenRouter is one implementation registered in the registry; adding another
 * provider must not require changes above this boundary.
 */

/* ------------------------------------------------------------------
   Models
   ------------------------------------------------------------------ */

/** Normalized catalog entry. Mirrors AIModelResponse at the API boundary. */
export type AIModel = {
  id: string;
  provider: ProviderId;
  name: string;
  description: string | null;
  contextLength: number | null;
  capabilities: AIModelCapabilities;
  pricing: {
    input: number | null;
    output: number | null;
  };
  isFree: boolean;
  isAvailable: boolean;
};

/* ------------------------------------------------------------------
   Messages (multimodal-ready; the file pipeline arrives in a later phase)
   ------------------------------------------------------------------ */

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } }
  | { type: "file"; file: { filename: string; dataUrl: string } };

export type AIMessage = {
  role: AIMessageRole;
  content: string | AIContentPart[];
};

/* ------------------------------------------------------------------
   Generation
   ------------------------------------------------------------------ */

export type AIResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      };
    };

export type AIGenerationRequest = {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Structured-output instruction. Standardized across OpenAI-compatible
   * providers; a provider that does not support it surfaces an error the
   * caller can fall back from.
   */
  responseFormat?: AIResponseFormat;
  metadata?: Record<string, unknown>;
};

export type AIUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type AIGenerationResult = {
  content: string;
  /** The model that actually produced the content. */
  model: string;
  /** The model the caller asked for; differs from `model` after a fallback. */
  requestedModel: string;
  fallbackUsed: boolean;
  /** Token accounting; null when the provider does not report it. */
  usage: AIUsage | null;
};

/** Normalized stream events, so callers never parse vendor SSE themselves. */
export type AIStreamEvent =
  | { type: "start"; model: string; requestedModel: string; fallbackUsed: boolean }
  | { type: "delta"; content: string }
  | { type: "usage"; usage: AIUsage }
  | { type: "error"; code: string; message: string }
  | { type: "complete" };

/* ------------------------------------------------------------------
   Capabilities and health
   ------------------------------------------------------------------ */

export type AICapability = keyof AIModelCapabilities;

export type ProviderHealth = {
  ok: boolean;
  reason?: string;
};

/**
 * The contract every provider implements.
 *
 * `signal` propagates caller cancellation: a provider must abort the upstream
 * request rather than keep consuming an expensive generation after the client
 * has gone away.
 */
export interface AIProvider {
  readonly id: ProviderId;
  /** Current catalog, already normalized. Throws AIError on failure. */
  listModels(signal?: AbortSignal): Promise<AIModel[]>;
  /** Single non-streamed completion. Throws AIError on failure. */
  generate(
    request: AIGenerationRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AIGenerationResult>;
  /** Real streamed completion as normalized events. */
  stream(
    request: AIGenerationRequest,
    options?: { signal?: AbortSignal }
  ): AsyncIterable<AIStreamEvent>;
  /** Cheap credential/reachability check. Never throws. */
  validateConfiguration(): Promise<ProviderHealth>;
  supports(capability: AICapability): boolean;
}
