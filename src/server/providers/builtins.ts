import { registerProvider } from "./registry";
import { openRouterProvider } from "./openrouter/provider";

/**
 * Built-in provider registration.
 *
 * Memoized so importing modules never re-register, and kept out of the
 * registry itself so tests can clear and replace registrations freely.
 */
let registered = false;

export function ensureBuiltinProviders(): void {
  if (registered) return;
  registerProvider(openRouterProvider);
  registered = true;
}

/** Test helper: allows suites to re-run registration after clearing. */
export function resetBuiltinProvidersForTesting(): void {
  registered = false;
}
