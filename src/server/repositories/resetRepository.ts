import { and, eq, gt, isNull } from "drizzle-orm";
import { ensureDbReady, getDb } from "../db/client";
import { passwordResetTokens } from "../db/schema";

/**
 * Password reset token repository. Only the hash of a reset token is stored, and
 * a token can be consumed exactly once.
 */

export type ResetTokenRow = typeof passwordResetTokens.$inferSelect;

export async function insertPasswordResetToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<ResetTokenRow> {
  await ensureDbReady();
  const [row] = await getDb().insert(passwordResetTokens).values(input).returning();
  return row;
}

/**
 * Atomically consumes a token: it must be unused and unexpired, and is marked
 * used in the same statement so it cannot be replayed by concurrent requests.
 */
export async function consumePasswordResetToken(
  tokenHash: string
): Promise<ResetTokenRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .returning();
  return row ?? null;
}