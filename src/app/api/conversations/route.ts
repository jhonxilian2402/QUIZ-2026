import { createRoute } from "@/server/http/route";
import { created, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { conversationCreateSchema, paginationSchema } from "@/lib/api/schemas";
import * as conversationService from "@/server/services/conversationService";

/**
 * GET /api/conversations — the caller's conversations, newest activity first.
 * POST /api/conversations — creates a conversation.
 *
 * Both are scoped to the authenticated user; there is no cross-user listing.
 */

export const GET = createRoute("conversations/list", async (request) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "conversations/list",
  });

  const url = new URL(request.url);
  const query = parseOrThrow(paginationSchema, {
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  return ok(
    await conversationService.list(auth.userId, {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
    })
  );
});

export const POST = createRoute("conversations/create", async (request) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "conversations/create",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.conversationCreate);

  const input = parseOrThrow(conversationCreateSchema, await readJson(request));
  return created(await conversationService.create(auth.userId, input));
});