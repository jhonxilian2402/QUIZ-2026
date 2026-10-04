import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import * as modelCatalogService from "@/server/services/modelCatalogService";
import type { AIProviderStatusResponse } from "@/lib/api/contracts";

/**
 * GET /api/ai/providers/status — aggregated provider health for signed-in
 * users: whether the platform key exists, whether the provider answered its
 * last contact, and catalog freshness. No credential material, endpoint
 * detail or infrastructure information is ever included.
 */
export const GET = createRoute("ai/providers/status", async () => {
  await requireUser({
    requestId: "",
    method: "GET",
    route: "ai/providers/status",
  });

  return ok<AIProviderStatusResponse>(await modelCatalogService.providerStatus());
});
