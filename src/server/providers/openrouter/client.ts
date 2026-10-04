import { AIError } from "@/server/errors";
import { logger } from "@/server/logger";
import { openRouterErrorBodySchema } from "./schemas";

/**
 * Centralized OpenRouter HTTP client.
 *
 * Every request to OpenRouter goes through this class — nowhere else. It owns:
 *   - authentication (the key lives only here, injected from server config),
 *   - per-operation timeouts,
 *   - controlled retries with exponential backoff for transient failures,
 *   - provider error extraction and normalization into AIError,
 *   - streaming responses as raw byte streams for the SSE parser.
 *
 * The API key is never logged, never included in error messages and never
 * leaves the server.
 */

export type OpenRouterClientOptions = {
  apiKey: string;
  baseUrl: string;
  /** Timeout for non-streamed generation requests. */
  timeoutMs: number;
  /** Extra attempts after the first, for transient failures only. */
  maxRetries: number;
  /** Attribution headers documented by OpenRouter; both optional. */
  appName?: string;
  appUrl?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

type RequestKind = "catalog" | "generation" | "health";

/** Catalog reads are cheap and fast; health checks cheaper still. */
const KIND_TIMEOUTS: Record<RequestKind, number> = {
  catalog: 15_000,
  health: 10_000,
  generation: 60_000,
};

function backoffDelay(attempt: number): number {
  // 300ms, 600ms, 1200ms… plus up to 100ms of jitter.
  return 300 * 2 ** attempt + Math.floor(Math.random() * 100);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error("Aborted"));
      },
      { once: true }
    );
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

/** Composes caller cancellation with a per-request timeout. */
function composeSignal(
  timeoutMs: number,
  caller?: AbortSignal
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("The request timed out.", "TimeoutError")),
    timeoutMs
  );
  const onAbort = () => controller.abort(caller?.reason);
  if (caller) {
    if (caller.aborted) onAbort();
    else caller.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      caller?.removeEventListener("abort", onAbort);
    },
  };
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly appName?: string;
  private readonly appUrl?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries;
    this.appName = options.appName;
    this.appUrl = options.appUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    // Optional attribution, only when configured — never invented values.
    if (this.appUrl) headers["HTTP-Referer"] = this.appUrl;
    if (this.appName) headers["X-Title"] = this.appName;
    return headers;
  }

  /**
   * Executes one attempt. Transient conditions are thrown as marked errors so
   * the retry loop can recognize them; everything else is final.
   */
  private async attempt(
    path: string,
    init: { method: string; body?: unknown },
    kind: RequestKind,
    callerSignal?: AbortSignal
  ): Promise<Response> {
    const { signal, clear } = composeSignal(
      kind === "generation" ? this.timeoutMs : KIND_TIMEOUTS[kind],
      callerSignal
    );

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: this.headers(),
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal,
      });
    } catch (error) {
      clear();
      if (callerSignal?.aborted) throw callerSignal.reason ?? error;
      if (isTimeoutError(error)) {
        throw new AIError("AI_REQUEST_TIMEOUT", "The AI provider took too long to respond.", {
          cause: error,
        });
      }
      if (isAbortError(error)) throw error;
      // DNS, TLS, connection reset: transient by nature.
      throw new AIError("AI_PROVIDER_UNAVAILABLE", "The AI provider could not be reached.", {
        cause: error,
      });
    }
    clear();

    if (response.ok) return response;

    throw await this.toError(response, callerSignal);
  }

  /** Maps a non-2xx response onto the normalized AI taxonomy. */
  private async toError(response: Response, callerSignal?: AbortSignal): Promise<AIError> {
    if (callerSignal?.aborted) {
      const reason = callerSignal.reason;
      return reason instanceof AIError
        ? reason
        : new AIError("AI_UNKNOWN_ERROR", "The request was cancelled.");
    }

    let providerMessage: string | undefined;
    try {
      const parsed = openRouterErrorBodySchema.safeParse(await response.json());
      if (parsed.success) providerMessage = parsed.data.error?.message;
    } catch {
      // A non-JSON error body carries no usable detail.
    }
    // Provider detail stays in the server log only, with the credential
    // redacted in case a provider message ever echoes it back.
    logger.warn("OpenRouter rejected a request", {
      status: response.status,
      providerMessage: providerMessage?.split(this.apiKey).join("[redacted]"),
    });

    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));

    switch (response.status) {
      case 401:
      case 403:
        return new AIError(
          "AI_AUTHENTICATION_FAILED",
          "The AI provider rejected the configured credentials."
        );
      case 404:
        return new AIError(
          "AI_MODEL_UNAVAILABLE",
          "The selected model is currently unavailable."
        );
      case 408:
        return new AIError("AI_REQUEST_TIMEOUT", "The AI provider took too long to respond.");
      case 429:
        // Rate-limited requests are not retried automatically.
        return new AIError(
          "AI_RATE_LIMITED",
          "The AI provider is temporarily rate limited. Please try again shortly.",
          { retryAfterSeconds }
        );
      case 400:
      case 402:
      case 422:
        return new AIError("AI_INVALID_REQUEST", "The AI provider rejected the request.", {
          expose: false,
        });
      default:
        return new AIError(
          "AI_PROVIDER_UNAVAILABLE",
          "The AI provider is temporarily unavailable."
        );
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof AIError) {
      return (
        error.aiCode === "AI_PROVIDER_UNAVAILABLE" ||
        error.aiCode === "AI_REQUEST_TIMEOUT"
      );
    }
    return false;
  }

  /** JSON request with retry for transient failures. */
  async requestJson(
    path: string,
    init: { method: string; body?: unknown },
    kind: RequestKind,
    callerSignal?: AbortSignal
  ): Promise<unknown> {
    let lastError: unknown;
    for (let attemptIndex = 0; attemptIndex <= this.maxRetries; attemptIndex++) {
      if (attemptIndex > 0) {
        await sleep(backoffDelay(attemptIndex - 1), callerSignal);
      }
      try {
        const response = await this.attempt(path, init, kind, callerSignal);
        try {
          return await response.json();
        } catch (error) {
          throw new AIError(
            "AI_CONTENT_ERROR",
            "The AI provider returned a malformed response.",
            { expose: false, cause: error }
          );
        }
      } catch (error) {
        if (callerSignal?.aborted) throw error;
        if (this.isRetryable(error) && attemptIndex < this.maxRetries) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new AIError("AI_UNKNOWN_ERROR", "The request failed.");
  }

  /**
   * Opens a streamed request. Retries are possible only before the stream
   * starts; once bytes flow, failures surface as stream errors instead.
   */
  async requestStream(
    path: string,
    body: unknown,
    callerSignal?: AbortSignal
  ): Promise<Response> {
    const response = await this.attempt(
      path,
      { method: "POST", body },
      "generation",
      callerSignal
    );
    if (!response.body) {
      throw new AIError("AI_CONTENT_ERROR", "The AI provider returned an empty stream.", {
        expose: false,
      });
    }
    return response;
  }
}
