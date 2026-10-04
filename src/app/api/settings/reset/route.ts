import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { resetSettings } from "@/server/services/settingsService";

/**
 * POST /api/settings/reset
 *
 * Restores every section to application defaults for this user. Kept separate
 * from PATCH so a destructive, whole-document reset is never an incidental
 * consequence of a normal settings update.
 */
export const POST = createRoute("settings/reset", async () => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "settings/reset",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  return ok(await resetSettings(auth.userId));
});