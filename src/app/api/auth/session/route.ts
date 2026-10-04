import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { getCurrentUser } from "@/server/http/context";
import type { SessionResponse } from "@/lib/api/contracts";

/**
 * GET /api/auth/session
 *
 * Reports whether the caller is signed in, plus safe session metadata. It is
 * intentionally unauthenticated so the application shell can decide between the
 * app and the sign-in screen on first load. No secret is returned.
 */
export const GET = createRoute("auth/session", async () => {
  const current = await getCurrentUser();

  if (!current) {
    const body: SessionResponse = { authenticated: false, user: null, session: null };
    return ok(body);
  }

  const body: SessionResponse = {
    authenticated: true,
    user: current.user,
    session: { expiresAt: current.expiresAt.toISOString() },
  };
  return ok(body);
});