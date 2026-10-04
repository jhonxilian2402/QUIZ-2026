import {
  createPasswordResetToken,
  createSessionToken,
  hashIp,
  hashSessionToken,
  RESET_TOKEN_TTL_MS,
  SESSION_TTL_MS,
} from "../auth/tokens";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../auth/password";
import {
  deleteUser,
  findUserByEmail,
  findUserById,
  findLiveSessionByTokenHash,
  insertSession,
  insertUser,
  revokeAllSessionsForUser,
  revokeSessionByTokenHash,
  toSessionUser,
  updateUser,
} from "../repositories/userRepository";
import { deleteSettingsForUser, upsertSettings } from "../repositories/settingsRepository";
import { DEFAULT_SETTINGS } from "@/lib/settingsDefaults";
import { AuthenticationError, ConflictError, mapDatabaseError, ValidationError } from "../errors";
import { logger } from "../logger";
import type { SessionUser, UserSettings } from "@/lib/api/contracts";
import type { LoginInput, RegisterInput } from "@/lib/api/schemas";

/**
 * Authentication service.
 *
 * Owns credentials, sessions and the login/registration flow. Route handlers
 * never touch password hashes or session rows directly.
 */

export type IssuedSession = {
  token: string;
  expiresAt: Date;
  user: SessionUser;
};

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function register(
  input: RegisterInput,
  context: { userAgent: string | null; ip: string | null }
): Promise<IssuedSession> {
  const email = normaliseEmail(input.email);

  const existing = await findUserByEmail(email);
  if (existing) {
    // Deliberately explicit: registration must tell the user the address is
    // taken, and there is no enumeration benefit beyond what signup already
    // reveals.
    throw new ConflictError("An account with that email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await insertUser({
      email,
      passwordHash,
      displayName: input.displayName.trim(),
    });
  } catch (error) {
    // The unique index is the real guard; a race between the check above and
    // the insert surfaces here as a constraint violation, which maps to the
    // same user-facing conflict.
    const mapped = mapDatabaseError(error);
    if (mapped instanceof ConflictError) {
      throw new ConflictError("An account with that email already exists.");
    }
    throw mapped;
  }

  // Every new account starts with an explicit, complete settings document so
  // later reads never depend on a missing row.
  await upsertSettings(user.id, structuredClone(DEFAULT_SETTINGS) as UserSettings);

  return issueSession(user.id, toSessionUser(user), context);
}

export async function login(
  input: LoginInput,
  context: { userAgent: string | null; ip: string | null }
): Promise<IssuedSession> {
  const email = normaliseEmail(input.email);
  const user = await findUserByEmail(email);

  // Verify against a dummy hash when the user is unknown so the response time
  // does not reveal whether the account exists.
  const storedHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const valid = await verifyPassword(input.password, storedHash);

  if (!user || !valid) {
    throw new AuthenticationError("Email or password is incorrect.");
  }

  if (user.status !== "active") {
    throw new AuthenticationError("This account is not active.");
  }

  await updateUser(user.id, { lastLoginAt: new Date() });
  return issueSession(user.id, toSessionUser(user), context);
}

async function issueSession(
  userId: string,
  user: SessionUser,
  context: { userAgent: string | null; ip: string | null }
): Promise<IssuedSession> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await insertSession({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent: context.userAgent?.slice(0, 400) ?? null,
    ipHash: hashIp(context.ip),
  });

  logger.info("Session issued", { userId, route: "auth" });
  return { token, expiresAt, user };
}

/** Resolves the current user from a raw session cookie token. */
export async function resolveSessionUser(
  token: string | null
): Promise<{ user: SessionUser; expiresAt: Date; userId: string } | null> {
  if (!token) return null;

  const session = await findLiveSessionByTokenHash(hashSessionToken(token));
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user || user.status !== "active") return null;

  return {
    user: toSessionUser(user),
    expiresAt: session.expiresAt,
    userId: user.id,
  };
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return;
  await revokeSessionByTokenHash(hashSessionToken(token));
}

/**
 * Begins a password reset.
 *
 * The same response is returned whether or not the address exists, so the
 * endpoint cannot be used to discover accounts. The token is returned to the
 * caller rather than emailed, because no mail service exists yet; the caller
 * must not expose it to the client in production.
 */
export async function requestPasswordReset(email: string): Promise<{
  token: string | null;
  expiresAt: Date | null;
}> {
  const user = await findUserByEmail(normaliseEmail(email));
  if (!user) return { token: null, expiresAt: null };

  const token = createPasswordResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const { insertPasswordResetToken } = await import("../repositories/resetRepository");
  await insertPasswordResetToken({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<void> {
  const { consumePasswordResetToken } = await import("../repositories/resetRepository");
  const record = await consumePasswordResetToken(hashSessionToken(token));
  if (!record) {
    throw new ValidationError("This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUser(record.userId, { passwordHash });
  // A password change invalidates every existing session.
  await revokeAllSessionsForUser(record.userId);

  logger.warn("Password reset completed", { userId: record.userId, route: "auth" });
}

/** Deletes the account and every dependent row through cascading deletes. */
export async function deleteAccount(userId: string): Promise<void> {
  await deleteSettingsForUser(userId);
  const removed = await deleteUser(userId);
  if (!removed) throw new ValidationError("Account could not be removed.");
  logger.warn("Account deleted", { userId, route: "auth" });
}