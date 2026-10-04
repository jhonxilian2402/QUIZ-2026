import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow, readJson } from "@/server/http/respond";
import { clientIp } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { passwordResetRequestSchema } from "@/lib/api/schemas";
import { requestPasswordReset } from "@/server/services/authService";
import { logger } from "@/server/logger";

/**
 * POST /api/auth/password-reset
 *
 * Starts a password reset. The response is identical whether or not the address
 * is registered, so the endpoint cannot be used to enumerate accounts.
 *
 * No mail service exists yet, so the token is logged server-side rather than
 * returned to the client; returning it would hand an attacker a reset link.
 */
export const POST = createRoute("auth/password-reset", async (request) => {
  const ip = await clientIp();
  enforceRateLimit(ip ?? "unknown", RATE_LIMITS.authReset);

  const input = parseOrThrow(passwordResetRequestSchema, await readJson(request));
  const result = await requestPasswordReset(input.email);

  if (result.token) {
    logger.info("Password reset requested", {
      route: "auth/password-reset",
      // The token itself is never logged; only that one was issued.
      expiresAt: result.expiresAt?.toISOString(),
    });
  }

  return ok({
    message:
      "If that email is registered, a reset link has been prepared. Email delivery is not connected yet.",
  });
});