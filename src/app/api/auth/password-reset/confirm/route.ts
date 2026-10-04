import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow, readJson } from "@/server/http/respond";
import { clientIp } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { passwordResetConfirmSchema } from "@/lib/api/schemas";
import { confirmPasswordReset } from "@/server/services/authService";

/**
 * POST /api/auth/password-reset/confirm
 *
 * Consumes a reset token exactly once and sets the new password. Every existing
 * session for the account is revoked as part of the reset.
 */
export const POST = createRoute("auth/password-reset/confirm", async (request) => {
  const ip = await clientIp();
  enforceRateLimit(ip ?? "unknown", RATE_LIMITS.authReset);

  const input = parseOrThrow(passwordResetConfirmSchema, await readJson(request));
  await confirmPasswordReset(input.token, input.password);

  return ok({ message: "Your password has been updated. Sign in with the new one." });
});