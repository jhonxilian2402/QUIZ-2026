import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, createTestUser } from "./helpers";
import { DEFAULT_SETTINGS } from "../src/lib/settingsDefaults";

/**
 * Settings persistence and validation.
 *
 * Confirms that settings round-trip per user, that a patch is validated, and
 * that an attempt to inject an unknown field is rejected rather than stored.
 */

before(async () => {
  await freshDatabase();
});

test("a new account starts from the application defaults", async () => {
  const { id } = await createTestUser();
  const { getSettings } = await import("../src/server/services/settingsService");

  const settings = await getSettings(id);
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test("a settings patch is persisted and returned", async () => {
  const { id } = await createTestUser();
  const { getSettings, patchSettings } = await import(
    "../src/server/services/settingsService"
  );

  const updated = await patchSettings(id, {
    appearance: { ...DEFAULT_SETTINGS.appearance, theme: "light", density: "compact" },
  });

  assert.equal(updated.appearance.theme, "light");
  assert.equal(updated.appearance.density, "compact");

  // Re-reading must return the stored document, not the defaults.
  const reloaded = await getSettings(id);
  assert.equal(reloaded.appearance.theme, "light");
  assert.equal(reloaded.appearance.density, "compact");
  // Untouched sections keep their defaults.
  assert.equal(reloaded.quiz.difficulty, DEFAULT_SETTINGS.quiz.difficulty);
});

test("settings are isolated per user", async () => {
  const alice = await createTestUser();
  const bob = await createTestUser();
  const { getSettings, patchSettings } = await import(
    "../src/server/services/settingsService"
  );

  await patchSettings(alice.id, {
    appearance: { ...DEFAULT_SETTINGS.appearance, accent: "teal" },
  });

  const aliceSettings = await getSettings(alice.id);
  const bobSettings = await getSettings(bob.id);

  assert.equal(aliceSettings.appearance.accent, "teal");
  assert.equal(
    bobSettings.appearance.accent,
    DEFAULT_SETTINGS.appearance.accent,
    "one user's change must not affect another user"
  );
});

test("an invalid settings value is rejected", async () => {
  const { id } = await createTestUser();
  const { patchSettings } = await import("../src/server/services/settingsService");

  await assert.rejects(
    () =>
      patchSettings(id, {
        // creativity must be within 0-100
        ai: { ...DEFAULT_SETTINGS.ai, creativity: 9999 },
      }),
    (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR"
  );
});

test("an unknown settings field is rejected, not silently stored", async () => {
  const { id } = await createTestUser();
  const { patchSettings } = await import("../src/server/services/settingsService");

  await assert.rejects(
    () =>
      patchSettings(id, {
        // Cast through unknown to simulate a hostile payload reaching the service.
        ...(JSON.parse(
          JSON.stringify({ appearance: { theme: "dark", injected: "malicious" } })
        ) as object),
      } as never),
    (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR",
    "a strict schema must refuse unexpected keys"
  );
});

test("resetting settings restores defaults", async () => {
  const { id } = await createTestUser();
  const { patchSettings, resetSettings, getSettings } = await import(
    "../src/server/services/settingsService"
  );

  await patchSettings(id, {
    appearance: { ...DEFAULT_SETTINGS.appearance, theme: "light" },
  });
  await resetSettings(id);

  const settings = await getSettings(id);
  assert.equal(settings.appearance.theme, DEFAULT_SETTINGS.appearance.theme);
});