import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import * as providerService from "@/server/services/providerService";

/**
 * GET /api/providers — configuration status for every known provider.
 *
 * Returns `configured: true/false` per provider. Raw credentials are never
 * included, and no response here can return one.
 */
export const GET = createRoute("providers/list", async () => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "providers/list",
  });
  return ok(await providerService.list(auth.userId));
});