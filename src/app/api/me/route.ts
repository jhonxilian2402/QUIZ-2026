import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { profileUpdateSchema } from "@/lib/api/schemas";
import { getProfile, updateProfile } from "@/server/services/userService";

/**
 * GET /api/me — the authenticated user's own profile.
 * PATCH /api/me — updates the user's own profile fields.
 *
 * Only the safe profile shape is returned: no password hash, provider
 * credentials, session tokens or security fields are ever serialized here.
 */

export const GET = createRoute("me/get", async () => {
  const auth = await requireUser({ requestId: "", method: "GET", route: "me/get" });
  return ok(await getProfile(auth.userId));
});

export const PATCH = createRoute("me/patch", async (request) => {
  const auth = await requireUser({ requestId: "", method: "PATCH", route: "me/patch" });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const input = parseOrThrow(profileUpdateSchema, await readJson(request));
  return ok(await updateProfile(auth.userId, input));
});