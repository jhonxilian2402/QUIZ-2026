import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import * as modelCatalogService from "@/server/services/modelCatalogService";
import type { AIModelCatalogResponse } from "@/lib/api/contracts";

/**
 * POST /api/ai/models/refresh — forces catalog revalidation.
 *
 * Rate-limited tightly because every refresh contacts the provider. When the
 * refresh fails and a previous catalog exists, the stale snapshot is returned
 * with `stale: true` rather than an error.
 */
export const POST = createRoute("ai/models/refresh", async () => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "ai/models/refresh",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.aiCatalogRefresh);

  return ok<AIModelCatalogResponse>(await modelCatalogService.refreshCatalog());
});
