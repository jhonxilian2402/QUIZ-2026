import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, ensureDbReady } from "../db/client";
import { sessions, users } from "../db/schema";
import type { SessionUser, UserStatus } from "@/lib/api/contracts";

/**
 * User repository.
 *
 * Database access stays here so services express intent rather than SQL, and so
 * every ownership-scoped lookup is written once.
 */

export type UserRow = typeof users.$inferSelect;

export async function findUserById(id: string): Promise<UserRow | null> {
  await ensureDbReady();
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row ?? null;
}

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  username?: string | null;
};

export async function insertUser(input: CreateUserInput): Promise<UserRow> {
  await ensureDbReady();
  const [row] = await getDb()
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      username: input.username ?? null,
    })
    .returning();
  return row;
}

export type UpdateUserInput = {
  displayName?: string;
  username?: string | null;
  bio?: string;
  avatarUrl?: string | null;
  passwordHash?: string;
  lastLoginAt?: Date;
  status?: UserStatus;
};

export async function updateUser(
  id: string,
  patch: UpdateUserInput
): Promise<UserRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row ?? null;
}

export async function deleteUser(id: string): Promise<boolean> {
  await ensureDbReady();
  const rows = await getDb().delete(users).where(eq(users.id, id)).returning();
  return rows.length > 0;
}

/* ---------------- Sessions ---------------- */

export type SessionRow = typeof sessions.$inferSelect;

export async function insertSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipHash: string | null;
}): Promise<SessionRow> {
  await ensureDbReady();
  const [row] = await getDb().insert(sessions).values(input).returning();
  return row;
}

/** Looks up a live session by token hash; revoked and expired rows never match. */
export async function findLiveSessionByTokenHash(
  tokenHash: string
): Promise<SessionRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  return row ?? null;
}

export async function revokeSessionByTokenHash(tokenHash: string): Promise<void> {
  await ensureDbReady();
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, tokenHash));
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await ensureDbReady();
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/* ---------------- Serializers ---------------- */

/** Public application profile. Never includes the password hash or secrets. */
export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    username: row.username,
    avatarUrl: row.avatarUrl,
    status: row.status,
  };
}