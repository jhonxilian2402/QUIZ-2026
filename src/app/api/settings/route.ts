import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { settingsPatchSchema } from "@/lib/api/schemas";
import { getSettings, patchSettings } from "@/server/services/settingsService";

/**
 * GET /api/settings — returns the user's complete settings document.
 * PATCH /api/settings — merges a validated patch and returns the result.
 *
 * The patch schema is strict, so an unknown field is rejected rather than stored
 * (no arbitrary keys can be injected into the settings object).
 */

export const GET = createRoute("settings/get", async () => {
  const auth = await requireUser({ requestId: "", method: "GET", route: "settings/get" });
  return ok(await getSettings(auth.userId));
});

export const PATCH = createRoute("settings/patch", async (request) => {
  const auth = await requireUser({
    requestId: "",
    method: "PATCH",
    route: "settings/patch",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const input = parseOrThrow(settingsPatchSchema, await readJson(request));
  return ok(await patchSettings(auth.userId, input));
});