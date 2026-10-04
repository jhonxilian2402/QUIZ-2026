import { randomBytes } from "node:crypto";
import { createRoute } from "@/server/http/route";
import { created, parseOrThrow, readJson } from "@/server/http/respond";
import { clientIp, userAgent } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { registerSchema } from "@/lib/api/schemas";
import { register } from "@/server/services/authService";
import { SESSION_TTL_MS } from "@/server/auth/tokens";
import { setCsrfCookie, setSessionCookie } from "@/server/auth/cookies";
import type { SessionResponse } from "@/lib/api/contracts";

/**
 * POST /api/auth/register
 *
 * Creates an account, seeds default settings and starts a session. The session
 * and CSRF cookies are set here; the response body never contains the token.
 */
export const POST = createRoute("auth/register", async (request) => {
  const ip = await clientIp();
  enforceRateLimit(ip ?? "unknown", RATE_LIMITS.authRegister);

  const input = parseOrThrow(registerSchema, await readJson(request));
  const agent = await userAgent();
  const session = await register(input, { userAgent: agent, ip });

  await setSessionCookie(session.token, SESSION_TTL_MS);
  await setCsrfCookie(randomBytes(32).toString("base64url"), SESSION_TTL_MS);

  const body: SessionResponse = {
    authenticated: true,
    user: session.user,
    session: { expiresAt: session.expiresAt.toISOString() },
  };
  return created(body);
});