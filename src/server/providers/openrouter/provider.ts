import { AIError } from "@/server/errors";
import { getEnv } from "@/server/config/env";
import { logger } from "@/server/logger";
import type {
  AIGenerationRequest,
  AIGenerationResult,
  AIMessage,
  AIModel,
  AIProvider,
  AIStreamEvent,
  ProviderHealth,
} from "../types";
import { OpenRouterClient } from "./client";
import { normalizeModel, normalizeUsage } from "./normalize";
import {
  openRouterCompletionSchema,
  openRouterKeyInfoSchema,
  openRouterModelListSchema,
} from "./schemas";
import { parseSseStream, parseStreamChunk } from "./stream";

/**
 * OpenRouter provider.
 *
 * The only place in the application that knows how OpenRouter works: endpoint
 * paths, request shape, SSE framing and vendor quirks. Everything above this
 * file speaks the normalized AIProvider contract.
 */

const PROVIDER_ID = "openrouter" as const;

/** Builds the centralized client from validated server configuration. */
function clientFromEnv(): OpenRouterClient | null {
  const env = getEnv();
  if (!env.OPENROUTER_API_KEY) return null;
  return new OpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    timeoutMs: env.OPENROUTER_TIMEOUT_MS,
    maxRetries: env.OPENROUTER_MAX_RETRIES,
    appName: env.OPENROUTER_APP_NAME,
    appUrl: env.APP_URL,
  });
}

function notConfigured(): AIError {
  return new AIError(
    "AI_PROVIDER_UNAVAILABLE",
    "The AI provider is not configured on this server."
  );
}

/** Translates the normalized message shape into the vendor wire format. */
function toWireMessages(messages: AIMessage[]): unknown[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content };
    }
    const parts = message.content.map((part) => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image_url") {
        return { type: "image_url", image_url: { url: part.imageUrl.url } };
      }
      // File parts are accepted by the abstraction but need the processing
      // pipeline of a later phase before they can be sent upstream.
      throw new AIError("AI_INVALID_REQUEST", "File input is not supported yet.", {
        expose: false,
      });
    });
    return { role: message.role, content: parts };
  });
}

function toWireBody(request: AIGenerationRequest, stream: boolean): Record<string, unknown> {
  return {
    model: request.model,
    messages: toWireMessages(request.messages),
    stream,
    // Ask for token accounting on streamed completions too.
    ...(stream ? { usage: { include: true } } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
    ...(request.responseFormat !== undefined
      ? { response_format: request.responseFormat }
      : {}),
  };
}

/** Extracts plain text from a completion's content field. */
function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string"
          ? part.text
          : ""
      )
      .join("");
  }
  return "";
}

export class OpenRouterProvider implements AIProvider {
  readonly id = PROVIDER_ID;

  constructor(private readonly getClient: () => OpenRouterClient | null = clientFromEnv) {}

  private requireClient(): OpenRouterClient {
    const client = this.getClient();
    if (!client) throw notConfigured();
    return client;
  }

  async listModels(signal?: AbortSignal): Promise<AIModel[]> {
    const client = this.requireClient();
    const payload = await client.requestJson("/models", { method: "GET" }, "catalog", signal);

    const parsed = openRouterModelListSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AIError(
        "AI_CONTENT_ERROR",
        "The AI provider returned a malformed model catalog.",
        { expose: false, cause: parsed.error }
      );
    }

    // Entries without a usable identity are dropped, never guessed at.
    return parsed.data.data
      .filter((entry) => typeof entry.id === "string" && entry.id.length > 0)
      .map(normalizeModel);
  }

  async generate(
    request: AIGenerationRequest,
    options: { signal?: AbortSignal } = {}
  ): Promise<AIGenerationResult> {
    const client = this.requireClient();
    const started = Date.now();

    const payload = await client.requestJson(
      "/chat/completions",
      { method: "POST", body: toWireBody(request, false) },
      "generation",
      options.signal
    );

    const parsed = openRouterCompletionSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AIError(
        "AI_CONTENT_ERROR",
        "The AI provider returned a malformed completion.",
        { expose: false, cause: parsed.error }
      );
    }

    const choice = parsed.data.choices?.[0];
    const content = extractContent(choice?.message?.content);
    if (!choice || content.length === 0) {
      throw new AIError(
        "AI_CONTENT_ERROR",
        "The AI provider returned an empty completion.",
        { expose: false }
      );
    }

    logger.info("AI generation completed", {
      provider: this.id,
      requestedModel: request.model,
      model: parsed.data.model ?? request.model,
      durationMs: Date.now() - started,
      hasUsage: parsed.data.usage !== undefined,
    });

    return {
      content,
      model: parsed.data.model ?? request.model,
      requestedModel: request.model,
      fallbackUsed: false,
      usage: normalizeUsage(parsed.data.usage),
    };
  }

  async *stream(
    request: AIGenerationRequest,
    options: { signal?: AbortSignal } = {}
  ): AsyncIterable<AIStreamEvent> {
    const client = this.requireClient();
    const response = await client.requestStream(
      "/chat/completions",
      toWireBody(request, true),
      options.signal
    );

    yield {
      type: "start",
      model: request.model,
      requestedModel: request.model,
      fallbackUsed: false,
    };

    // Completion, provider error or client cancellation all end here; the
    // parser's finally block closes the upstream connection in every case.
    for await (const event of parseSseStream(response.body!, options.signal)) {
      const parsed = parseStreamChunk(event.data);
      if (parsed === null) break; // [DONE]
      if (!parsed.success) continue; // malformed event: skip, keep streaming

      const chunk = parsed.data;

      // Mid-stream provider failures arrive as data, not HTTP status.
      if (chunk.error) {
        yield {
          type: "error",
          code: "AI_PROVIDER_UNAVAILABLE",
          message: "The AI provider interrupted the response.",
        };
        return;
      }

      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield { type: "delta", content: delta };

      const usage = normalizeUsage(chunk.usage);
      if (usage) yield { type: "usage", usage };
    }

    yield { type: "complete" };
  }

  async validateConfiguration(): Promise<ProviderHealth> {
    const client = this.getClient();
    if (!client) {
      return { ok: false, reason: "The platform OpenRouter key is not configured." };
    }
    try {
      // GET /key is the cheapest authenticated probe the API offers.
      const payload = await client.requestJson("/key", { method: "GET" }, "health");
      const parsed = openRouterKeyInfoSchema.safeParse(payload);
      if (!parsed.success) {
        return { ok: false, reason: "The provider returned an unexpected response." };
      }
      return { ok: true };
    } catch (error) {
      if (error instanceof AIError) {
        return { ok: false, reason: error.message };
      }
      return { ok: false, reason: "The provider could not be reached." };
    }
  }

  supports(): boolean {
    // OpenRouter exposes every tracked capability at provider level; whether a
    // specific model honors it lives in that model's catalog entry.
    return true;
  }
}

/** Singleton registered in the provider registry. */
export const openRouterProvider = new OpenRouterProvider();
