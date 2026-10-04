import { ApiError, NetworkError } from "./client";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf";
import type { ChatStreamEvent } from "./contracts";

/**
 * Chat stream client.
 *
 * Consumes the SSE endpoint with fetch (EventSource cannot POST). Events are
 * parsed incrementally and delivered through handlers; the AbortSignal the
 * caller supplies cancels both the HTTP request and the provider generation
 * behind it.
 */

export type ChatStreamHandlers = {
  onEvent: (event: ChatStreamEvent) => void;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

async function readErrorEnvelope(response: Response): Promise<never> {
  let payload: { error?: { code?: string; message?: string; details?: Record<string, string[]>; requestId?: string } } | undefined;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  throw new ApiError({
    status: response.status,
    code: payload?.error?.code ?? "INTERNAL_ERROR",
    message: payload?.error?.message ?? "Something went wrong.",
    details: payload?.error?.details,
    requestId: payload?.error?.requestId,
  });
}

/**
 * Sends one chat turn and streams the reply. Resolves when the stream ends
 * (complete or error event); rejects only for pre-stream failures (standard
 * error envelope), network loss, or abort.
 */
export async function streamChatTurn(
  conversationId: string,
  input: { content: string; clientRequestId?: string; model?: string | null; attachments?: string[] },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  const csrf = readCookie(CSRF_COOKIE_NAME);
  if (csrf) headers[CSRF_HEADER_NAME] = csrf;

  let response: Response;
  try {
    response = await fetch(`/api/conversations/${conversationId}/chat`, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new NetworkError();
  }

  if (!response.ok || !response.body) {
    await readErrorEnvelope(response);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (rawEvent: string): void => {
    const lines = rawEvent.split(/\r?\n/);
    const dataLines: string[] = [];
    for (const line of lines) {
      // The `event:` field mirrors the parsed payload's own `type`; the data
      // frame is authoritative.
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;
    try {
      const parsed = JSON.parse(dataLines.join("\n")) as ChatStreamEvent;
      handlers.onEvent(parsed);
    } catch {
      // A malformed frame is skipped; the stream continues.
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
        dispatch(rawEvent);
      }
    }
    if (buffer.trim().length > 0) dispatch(buffer);
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
