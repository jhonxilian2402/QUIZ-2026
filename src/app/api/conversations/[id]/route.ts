import { createRoute } from "@/server/http/route";
import { noContent, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { conversationUpdateSchema } from "@/lib/api/schemas";
import * as conversationService from "@/server/services/conversationService";

/**
 * GET /api/conversations/:id — one conversation owned by the caller.
 * PATCH /api/conversations/:id — rename, change model or archive.
 * DELETE /api/conversations/:id — removes the conversation and its messages.
 *
 * A conversation belonging to another user resolves to 404, never 403: the API
 * does not confirm that someone else's id exists.
 */

type Params = { id: string };

export const GET = createRoute<Params>("conversations/get", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "conversations/get",
  });
  return ok(await conversationService.getById(auth.userId, params.id));
});

export const PATCH = createRoute<Params>("conversations/update", async (request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "PATCH",
    route: "conversations/update",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const input = parseOrThrow(conversationUpdateSchema, await readJson(request));
  return ok(await conversationService.update(auth.userId, params.id, input));
});

export const DELETE = createRoute<Params>("conversations/delete", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "DELETE",
    route: "conversations/delete",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  await conversationService.remove(auth.userId, params.id);
  return noContent();
});