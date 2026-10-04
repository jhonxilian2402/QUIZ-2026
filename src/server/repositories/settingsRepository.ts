import { eq } from "drizzle-orm";
import { ensureDbReady, getDb } from "../db/client";
import { userSettings } from "../db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settingsDefaults";
import type { UserSettings } from "@/lib/api/contracts";

/**
 * Settings repository.
 *
 * Reads fall back to the shared defaults when a user has never saved settings,
 * so the API always returns a complete, valid document. Writes replace the
 * whole document, which the service has already validated.
 */

export type UserSettingsRow = typeof userSettings.$inferSelect;

export async function findSettings(userId: string): Promise<UserSettingsRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertSettings(
  userId: string,
  settings: UserSettings
): Promise<UserSettingsRow> {
  await ensureDbReady();
  const [row] = await getDb()
    .insert(userSettings)
    .values({ userId, settings })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { settings, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function deleteSettingsForUser(userId: string): Promise<void> {
  await ensureDbReady();
  await getDb().delete(userSettings).where(eq(userSettings.userId, userId));
}

/** Returns stored settings or a fresh copy of the application defaults. */
export async function getSettingsOrDefaults(userId: string): Promise<UserSettings> {
  const row = await findSettings(userId);
  // A copy is returned so callers cannot mutate the shared default object.
  return row?.settings ?? structuredClone(DEFAULT_SETTINGS);
}