import { randomUUID } from "node:crypto";
import { resetDatabaseForTesting, ensureDbReady } from "../src/server/db/client";
import { resetRateLimits } from "../src/server/rateLimit";
import { clearProviders } from "../src/server/providers/registry";

/**
 * Test policies.
 *
 * Each test case gets a fresh database and empty rate-limit buckets, so cases
 * cannot influence each other and isolation assertions are meaningful. Running
 * cases concurrently would share one embedded database, so each file runs
 * serially.
 *
 * Environment is configured in `tests/setup.ts`, which runs before any
 * application module is imported.
 */

let initialised = false;

export async function freshDatabase(): Promise<void> {
  if (!initialised) {
    initialised = true;
  }
  await resetDatabaseForTesting();
  await ensureDbReady();
  resetRateLimits();
  clearProviders();
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID()}@example.test`;
}

export const TEST_PASSWORD = "correct-horse-battery-staple";

/**
 * Creates an account through the service layer and returns its identifiers.
 * Used to set up distinct users whose isolation is then asserted.
 */
export async function createTestUser(options: {
  email?: string;
  displayName?: string;
  password?: string;
} = {}): Promise<{ id: string; email: string; password: string }> {
  const { register } = await import("../src/server/services/authService");
  const email = options.email ?? uniqueEmail();
  const password = options.password ?? TEST_PASSWORD;

  const session = await register(
    { email, password, displayName: options.displayName ?? "Test User" },
    { userAgent: "node-test", ip: "127.0.0.1" }
  );

  return { id: session.user.id, email, password };
}

/** Signs in and returns the raw session token, standing in for a cookie jar. */
export async function loginToken(email: string, password: string): Promise<string> {
  const { login } = await import("../src/server/services/authService");
  const session = await login({ email, password }, { userAgent: "node-test", ip: "127.0.0.1" });
  return session.token;
}