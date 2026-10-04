import { createRoute } from "@/server/http/route";
import { created, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { messageCreateSchema, paginationSchema } from "@/lib/api/schemas";
import * as conversationService from "@/server/services/conversationService";

/**
 * GET /api/conversations/:id/messages — paginated history for the conversation.
 * POST /api/conversations/:id/messages — stores a message.
 *
 * Messages are returned newest-first so the client can page backwards while
 * scrolling up. POST persists the message only: generating an assistant reply
 * requires a connected provider and belongs to a later phase, so no assistant
 * content is invented here.
 */

type Params = { id: string };

export const GET = createRoute<Params>(
  "messages/list",
  async (request, { params }) => {
    const auth = await requireUser({
      requestId: "",
      method: "GET",
      route: "messages/list",
    });

    const url = new URL(request.url);
    const query = parseOrThrow(paginationSchema, {
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    return ok(
      await conversationService.listMessagesForConversation(auth.userId, params.id, {
        limit: query.limit,
        cursor: query.cursor,
      })
    );
  }
);

export const POST = createRoute<Params>(
  "messages/create",
  async (request, { params }) => {
    const auth = await requireUser({
      requestId: "",
      method: "POST",
      route: "messages/create",
    });
    enforceRateLimit(auth.userId, RATE_LIMITS.messageCreate);

    const input = parseOrThrow(messageCreateSchema, await readJson(request));
    return created(
      await conversationService.addMessage(auth.userId, params.id, input)
    );
  }
);