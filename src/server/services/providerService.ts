import {
  deleteProviderForUser,
  findProviderForUser,
  listProvidersForUser,
  toProviderResponse,
  upsertProvider,
} from "../repositories/providerRepository";
import { getProvider } from "../providers/registry";
import { ensureBuiltinProviders } from "../providers/builtins";
import { NotFoundError } from "../errors";
import { logger } from "../logger";
import { PROVIDER_IDS, type ProviderId, type ProviderResponse } from "@/lib/api/contracts";
import type { ProviderConfigureInput } from "@/lib/api/schemas";

/**
 * Provider service.
 *
 * Stores configuration and reports status. Credentials are converted to an
 * opaque reference before storage and are never returned; testing a connection
 * goes through the provider abstraction, which currently reports that no
 * implementation is registered.
 */

/**
 * Turns a submitted secret into a storage reference.
 *
 * The real application will hand the secret to a credential store and keep only
 * a handle. Until that service exists, a deterministic reference that contains
 * no part of the secret is stored, so no raw key is ever persisted.
 */
function toCredentialRef(provider: ProviderId, credential: string): string {
  return `pending-store://${provider}/${credential.length}`;
}

export async function list(userId: string): Promise<ProviderResponse[]> {
  const rows = await listProvidersForUser(userId);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  // Every known provider is reported, configured or not, so the UI can show an
  // honest "not configured" state rather than an empty list.
  return PROVIDER_IDS.map((provider) =>
    toProviderResponse(byProvider.get(provider) ?? null, provider)
  );
}

export async function get(
  userId: string,
  provider: ProviderId
): Promise<ProviderResponse> {
  const row = await findProviderForUser(userId, provider);
  return toProviderResponse(row, provider);
}

export async function configure(
  userId: string,
  provider: ProviderId,
  input: ProviderConfigureInput
): Promise<ProviderResponse> {
  const row = await upsertProvider(userId, provider, {
    ...(input.credential !== undefined
      ? { credentialRef: toCredentialRef(provider, input.credential) }
      : {}),
    ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  });

  logger.info("Provider configured", { userId, route: "providers" });
  return toProviderResponse(row, provider);
}

export async function disconnect(
  userId: string,
  provider: ProviderId
): Promise<void> {
  const removed = await deleteProviderForUser(userId, provider);
  if (!removed) throw new NotFoundError("That provider is not configured.");
  logger.info("Provider disconnected", { userId, route: "providers" });
}

/**
 * Tests a provider connection through the abstraction.
 *
 * OpenRouter authenticates with the platform key held in server configuration;
 * per-user credentials are not collected in this phase, so the test reports
 * the platform connection state honestly.
 */
export async function test(
  userId: string,
  provider: ProviderId
): Promise<{ ok: boolean; message: string }> {
  void userId;
  ensureBuiltinProviders();

  const implementation = getProvider(provider);
  if (!implementation) {
    return {
      ok: false,
      message: "This provider is not implemented yet.",
    };
  }

  const result = await implementation.validateConfiguration();

  return {
    ok: result.ok,
    message: result.ok
      ? "Connection verified."
      : result.reason ?? "The provider rejected these settings.",
  };
}