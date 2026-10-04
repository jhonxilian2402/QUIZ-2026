import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { fileSearchSchema } from "@/lib/api/schemas";
import * as fileService from "@/server/services/fileService";

/**
 * POST /api/files/search — ranked owner-scoped chunk search across the
 * caller's own files. Unauthorized file ids are simply excluded rather than
 * revealing that they exist.
 */
export const POST = createRoute("files/search", async (request) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "files/search",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.fileSearch);

  const input = parseOrThrow(fileSearchSchema, await readJson(request));
  const results = await fileService.search(auth.userId, input);
  return ok({ results });
});
