import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { fileContentQuerySchema } from "@/lib/api/schemas";
import * as fileService from "@/server/services/fileService";

/**
 * GET /api/files/:id/content — paginated extracted text for the owner's file.
 * Never public; the extracted content is private to its owner.
 */
type Params = { id: string };

export const GET = createRoute<Params>("files/content", async (request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "files/content",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.read);

  const url = new URL(request.url);
  const query = parseOrThrow(fileContentQuerySchema, {
    offset: url.searchParams.get("offset") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  return ok(
    await fileService.content(auth.userId, params.id, {
      offset: query.offset,
      limit: query.limit,
    })
  );
});
