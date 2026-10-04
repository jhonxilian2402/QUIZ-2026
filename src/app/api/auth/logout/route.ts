import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { readSessionCookie } from "@/server/auth/cookies";
import { clearSessionCookie } from "@/server/auth/cookies";
import { logout } from "@/server/services/authService";
import type { SessionResponse } from "@/lib/api/contracts";

/**
 * POST /api/auth/logout
 *
 * Revokes the current session server-side and clears the cookie. Revoking the
 * server record matters: deleting the cookie alone would leave a valid token
 * that a copied cookie could still use.
 */
export const POST = createRoute("auth/logout", async () => {
  const token = await readSessionCookie();
  await logout(token);
  await clearSessionCookie();

  const body: SessionResponse = { authenticated: false, user: null, session: null };
  return ok(body);
});