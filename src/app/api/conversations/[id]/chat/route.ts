import { createRoute } from "@/server/http/route";
import { parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { chatMessageSchema } from "@/lib/api/schemas";
import { runChatTurn } from "@/server/services/chatService";
import { logger } from "@/server/logger";
import type { ChatStreamEvent } from "@/lib/api/contracts";

/**
 * POST /api/conversations/:id/chat — one complete chat turn over SSE.
 *
 * The user message is persisted first, then the assistant reply streams from
 * the real provider as normalized events (start/delta/usage/complete/error).
 * Errors that occur before the turn starts (auth, validation, ownership,
 * model resolution, rate limits) use the standard JSON error envelope;
 * failures mid-turn arrive as `error` events with the user message preserved.
 *
 * Client disconnects abort the provider request; partial output is persisted
 * marked as cancelled, never as a successful answer.
 */

type Params = { id: string };

function encode(event: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export const POST = createRoute<Params>("chat/turn", async (request, { params, requestId }) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "chat/turn",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.chatGenerate);

  const input = parseOrThrow(chatMessageSchema, await readJson(request));

  // Abort the provider call when the client goes away.
  const controller = new AbortController();
  const onClientAbort = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) onClientAbort();
  else request.signal.addEventListener("abort", onClientAbort, { once: true });

  const turn = runChatTurn({
    userId: auth.userId,
    conversationId: params.id,
    input,
    signal: controller.signal,
    requestId,
  });

  // Pre-flight: the first pull surfaces ownership/validation/lock/model
  // failures as the standard JSON error envelope instead of an SSE frame.
  const iterator = turn[Symbol.asyncIterator]();
  const first = await iterator.next();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      try {
        if (!first.done) streamController.enqueue(encode(first.value));
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          streamController.enqueue(encode(next.value));
        }
        streamController.close();
      } catch (error) {
        // Unexpected generator failure mid-stream: close with a safe event.
        logger.error("Chat stream failed unexpectedly", {
          requestId,
          route: "chat/turn",
          detail: error instanceof Error ? error.message : String(error),
        });
        try {
          streamController.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: "error",
                code: "AI_UNKNOWN_ERROR",
                message: "The response could not be generated. Please try again.",
                userMessage: null,
                assistantMessage: null,
              })}\n\n`
            )
          );
          streamController.close();
        } catch {
          // The stream is already broken; nothing else can be delivered.
        }
      } finally {
        request.signal.removeEventListener("abort", onClientAbort);
      }
    },
    async cancel() {
      // The client disconnected: unwind the generator so locks release and
      // the provider request is aborted through the composed signal.
      controller.abort();
      await iterator.return?.(undefined);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
