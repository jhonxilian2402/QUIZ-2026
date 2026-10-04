import type { ProviderId } from "@/lib/api/contracts";
import type { AIProvider } from "./types";

/**
 * Provider registry.
 *
 * Implementations register themselves here. In this phase the registry is
 * intentionally empty: OpenRouter arrives in the next phase and will be added
 * with a single registration call, which is what keeps the rest of the
 * application vendor-neutral.
 */
const registry = new Map<ProviderId, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: ProviderId): AIProvider | null {
  return registry.get(id) ?? null;
}

export function listRegisteredProviders(): ProviderId[] {
  return [...registry.keys()];
}

/** Test helper: clears registrations between suites. */
export function clearProviders(): void {
  registry.clear();
}