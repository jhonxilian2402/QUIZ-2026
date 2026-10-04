import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "@/lib/api/csrf";

/**
 * Centralized API client.
 *
 * Components never call `fetch` directly. This module owns:
 *   - the shared success/error envelope handling,
 *   - the CSRF header for state-changing requests,
 *   - request cancellation,
 *   - mapping failures onto a single typed error the UI can branch on.
 *
 * It imports only isomorphic code, so it is safe in the browser bundle.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.requestId = input.requestId;
  }
}

/** Raised when the request could not reach the server at all. */
export class NetworkError extends ApiError {
  constructor(message = "Could not reach the server. Check your connection.") {
    super({ status: 0, code: "NETWORK_ERROR", message });
    this.name = "NetworkError";
  }
}

export type RequestOptions = {
  signal?: AbortSignal;
  /** Query parameters; undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) headers["Content-Type"] = "application/json";

  // Double-submit CSRF: echo the non-secret cookie value in a header.
  if (MUTATING.has(method)) {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    // An aborted request is not a failure the UI should report.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text.length > 0 ? safeJson(text) : undefined;

  if (!response.ok) {
    const envelope = payload as
      | { error?: { code?: string; message?: string; details?: Record<string, string[]>; requestId?: string } }
      | undefined;
    throw new ApiError({
      status: response.status,
      code: envelope?.error?.code ?? "INTERNAL_ERROR",
      message: envelope?.error?.message ?? "Something went wrong.",
      details: envelope?.error?.details,
      requestId: envelope?.error?.requestId,
    });
  }

  // Unwrap the { data } envelope so callers receive the resource directly.
  return (payload as { data: T }).data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function requestForm<T>(path: string, form: FormData, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (MUTATING.has("POST")) {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  }
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: form,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new NetworkError();
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const payload: unknown = text.length > 0 ? safeJson(text) : undefined;
  if (!response.ok) {
    const envelope = payload as
      | { error?: { code?: string; message?: string; details?: Record<string, string[]>; requestId?: string } }
      | undefined;
    throw new ApiError({
      status: response.status,
      code: envelope?.error?.code ?? "INTERNAL_ERROR",
      message: envelope?.error?.message ?? "Something went wrong.",
      details: envelope?.error?.details,
      requestId: envelope?.error?.requestId,
    });
  }
  return (payload as { data: T }).data;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
  postForm: <T>(path: string, form: FormData, options?: RequestOptions) =>
    requestForm<T>(path, form, options),
};

/** True when the failure means the caller is not signed in. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** True when the failure is a connectivity problem rather than a rejection. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof NetworkError;
}