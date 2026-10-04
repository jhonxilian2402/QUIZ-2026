import { randomBytes } from "node:crypto";
import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow, readJson } from "@/server/http/respond";
import { clientIp, userAgent } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { loginSchema } from "@/lib/api/schemas";
import { login } from "@/server/services/authService";
import { SESSION_TTL_MS } from "@/server/auth/tokens";
import { setCsrfCookie, setSessionCookie } from "@/server/auth/cookies";
import type { SessionResponse } from "@/lib/api/contracts";

/**
 * POST /api/auth/login
 *
 * Verifies credentials and issues a new session. Failed attempts are rate
 * limited per client address and return a single generic message.
 */
export const POST = createRoute("auth/login", async (request) => {
  const ip = await clientIp();
  enforceRateLimit(ip ?? "unknown", RATE_LIMITS.authLogin);

  const input = parseOrThrow(loginSchema, await readJson(request));
  const agent = await userAgent();
  const session = await login(input, { userAgent: agent, ip });

  await setSessionCookie(session.token, SESSION_TTL_MS);
  await setCsrfCookie(randomBytes(32).toString("base64url"), SESSION_TTL_MS);

  const body: SessionResponse = {
    authenticated: true,
    user: session.user,
    session: { expiresAt: session.expiresAt.toISOString() },
  };
  return ok(body);
});