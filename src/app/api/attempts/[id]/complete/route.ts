import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import * as attemptService from "@/server/services/attemptService";

/**
 * POST /api/attempts/:id/complete — finalises an attempt.
 *
 * Scoring is recomputed on the server from stored answers and questions, so the
 * final counts cannot be influenced by anything the client sends.
 */
type Params = { id: string };

export const POST = createRoute<Params>("attempts/complete", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "attempts/complete",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  return ok(await attemptService.complete(auth.userId, params.id));
});