import { and, eq } from "drizzle-orm";
import { ensureDbReady, getDb } from "../db/client";
import { apiProviderConfigurations } from "../db/schema";
import type { ProviderId, ProviderResponse } from "@/lib/api/contracts";

/**
 * Provider configuration repository.
 *
 * The credential is stored as an opaque reference, never the raw value, and the
 * serializer exposes only whether a provider is configured. There is no code
 * path that returns a secret to a client.
 */

export type ProviderRow = typeof apiProviderConfigurations.$inferSelect;

export async function listProvidersForUser(userId: string): Promise<ProviderRow[]> {
  await ensureDbReady();
  return getDb()
    .select()
    .from(apiProviderConfigurations)
    .where(eq(apiProviderConfigurations.userId, userId));
}

export async function findProviderForUser(
  userId: string,
  provider: ProviderId
): Promise<ProviderRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(apiProviderConfigurations)
    .where(
      and(
        eq(apiProviderConfigurations.userId, userId),
        eq(apiProviderConfigurations.provider, provider)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function upsertProvider(
  userId: string,
  provider: ProviderId,
  patch: {
    credentialRef?: string | null;
    defaultModel?: string | null;
    enabled?: boolean;
  }
): Promise<ProviderRow> {
  await ensureDbReady();
  const [row] = await getDb()
    .insert(apiProviderConfigurations)
    .values({
      userId,
      provider,
      credentialRef: patch.credentialRef ?? null,
      defaultModel: patch.defaultModel ?? null,
      enabled: patch.enabled ?? false,
    })
    .onConflictDoUpdate({
      target: [apiProviderConfigurations.userId, apiProviderConfigurations.provider],
      set: {
        ...(patch.credentialRef !== undefined
          ? { credentialRef: patch.credentialRef }
          : {}),
        ...(patch.defaultModel !== undefined
          ? { defaultModel: patch.defaultModel }
          : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/** Removes stored configuration for a provider, including its credential ref. */
export async function deleteProviderForUser(
  userId: string,
  provider: ProviderId
): Promise<boolean> {
  await ensureDbReady();
  const rows = await getDb()
    .delete(apiProviderConfigurations)
    .where(
      and(
        eq(apiProviderConfigurations.userId, userId),
        eq(apiProviderConfigurations.provider, provider)
      )
    )
    .returning();
  return rows.length > 0;
}

/**
 * Serializer. `configured` reflects the presence of a credential reference; the
 * reference itself is never included.
 */
export function toProviderResponse(
  row: ProviderRow | null,
  provider: ProviderId
): ProviderResponse {
  return {
    provider,
    configured: Boolean(row?.credentialRef),
    enabled: row?.enabled ?? false,
    defaultModel: row?.defaultModel ?? null,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}