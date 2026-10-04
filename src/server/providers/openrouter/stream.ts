import { AIError } from "@/server/errors";
import { openRouterStreamChunkSchema } from "./schemas";

/**
 * Server-Sent Events parser for OpenRouter streams.
 *
 * Turns the raw byte stream into parsed JSON chunks, handling the realities of
 * SSE: events split across reads, multi-line data fields, comment keep-alives
 * and the [DONE] terminator. Malformed events are skipped rather than killing
 * the stream; a malformed stream surface is reported by the caller.
 */

export type SseEvent = {
  data: string;
};

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line.
      let boundary: number;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");

        const dataLines: string[] = [];
        for (const line of rawEvent.split(/\r?\n/)) {
          if (line.startsWith(":")) continue; // keep-alive comment
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length > 0) yield { data: dataLines.join("\n") };
      }
    }

    // A trailing event without the final blank line is still valid.
    const trailing = buffer.trim();
    if (trailing.startsWith("data:")) {
      yield { data: trailing.slice(5).trimStart() };
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Parses one `data:` payload as a stream chunk; null for [DONE]. */
export function parseStreamChunk(
  data: string
): ReturnType<typeof openRouterStreamChunkSchema.safeParse> | null {
  if (data === "[DONE]") return null;
  try {
    return openRouterStreamChunkSchema.safeParse(JSON.parse(data));
  } catch {
    return openRouterStreamChunkSchema.safeParse(undefined);
  }
}

export function streamError(message: string, cause?: unknown): AIError {
  return new AIError("AI_CONTENT_ERROR", message, { expose: false, cause });
}
