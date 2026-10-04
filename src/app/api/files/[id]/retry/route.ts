import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import * as fileService from "@/server/services/fileService";

/**
 * POST /api/files/:id/retry — re-runs the processing pipeline for a file the
 * caller owns. Concurrent duplicate runs are rejected.
 */
type Params = { id: string };

export const POST = createRoute<Params>("files/retry", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "files/retry",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  return ok({ file: await fileService.retryProcessing(auth.userId, params.id) });
});
