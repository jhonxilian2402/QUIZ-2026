import { getSettingsOrDefaults, upsertSettings } from "../repositories/settingsRepository";
import { settingsSchema } from "@/lib/api/schemas";
import { AIError, ValidationError } from "../errors";
import { assertModelUsable } from "./modelCatalogService";
import type { SettingsPatchInput } from "@/lib/api/schemas";
import type { UserSettings } from "@/lib/api/contracts";

/**
 * Settings service.
 *
 * Reads always return a complete document. Writes merge a validated patch over
 * the stored document and then re-validate the whole result, so a patch cannot
 * introduce an invalid combination or an unexpected field.
 */

export async function getSettings(userId: string): Promise<UserSettings> {
  return getSettingsOrDefaults(userId);
}

/** Values that mean "no explicit model": automatic selection is always valid. */
const AUTOMATIC_MODEL_SENTINELS = new Set(["", "assistant"]);

/**
 * Verifies every model preference the patch touches against the live catalog.
 * A model id is never trusted from the client: it must exist and be currently
 * available. Catalog-level failures (provider down, not configured) surface as
 * their own AI errors rather than a misleading "invalid model".
 */
async function validateModelPreferences(patch: SettingsPatchInput): Promise<void> {
  const fields: Array<{ path: string; value: string | null | undefined }> = [];

  if (patch.ai && "defaultModelId" in patch.ai) {
    fields.push({ path: "ai.defaultModelId", value: patch.ai.defaultModelId });
  }
  if (patch.ai && "fallbackModelId" in patch.ai) {
    fields.push({ path: "ai.fallbackModelId", value: patch.ai.fallbackModelId });
  }
  if (patch.chat && "defaultModelId" in patch.chat) {
    fields.push({ path: "chat.defaultModelId", value: patch.chat.defaultModelId });
  }
  if (patch.api && "openRouterDefaultModelId" in patch.api) {
    fields.push({ path: "api.openRouterDefaultModelId", value: patch.api.openRouterDefaultModelId });
  }
  if (patch.api && "openRouterFallbackModelId" in patch.api) {
    fields.push({ path: "api.openRouterFallbackModelId", value: patch.api.openRouterFallbackModelId });
  }

  for (const field of fields) {
    const value = field.value;
    if (value === null || value === undefined || AUTOMATIC_MODEL_SENTINELS.has(value)) {
      continue;
    }
    try {
      await assertModelUsable(value);
    } catch (error) {
      if (error instanceof AIError && error.aiCode === "AI_MODEL_UNAVAILABLE") {
        throw new ValidationError("Some settings are not valid.", {
          details: { [field.path]: ["That model is not currently available."] },
        });
      }
      throw error;
    }
  }
}

export async function patchSettings(
  userId: string,
  patch: SettingsPatchInput
): Promise<UserSettings> {
  // Model preferences are verified against the live catalog before anything
  // is merged; a catalog outage rejects the model change, not other settings.
  await validateModelPreferences(patch);

  const current = await getSettingsOrDefaults(userId);

  // Each section is merged explicitly so TypeScript can verify the result is a
  // complete, correctly-typed document rather than a union of partial shapes.
  const merged: UserSettings = {
    appearance: { ...current.appearance, ...patch.appearance },
    chat: { ...current.chat, ...patch.chat },
    ai: { ...current.ai, ...patch.ai },
    quiz: { ...current.quiz, ...patch.quiz },
    search: { ...current.search, ...patch.search },
    files: { ...current.files, ...patch.files },
    notifications: { ...current.notifications, ...patch.notifications },
    privacy: { ...current.privacy, ...patch.privacy },
    api: { ...current.api, ...patch.api },
    advanced: { ...current.advanced, ...patch.advanced },
  };

  // Validate the complete document, not just the patch: this catches a stored
  // value that has become invalid after a schema change.
  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "(root)";
      (details[path] ??= []).push(issue.message);
    }
    throw new ValidationError("Some settings are not valid.", { details });
  }

  await upsertSettings(userId, parsed.data as UserSettings);
  return parsed.data as UserSettings;
}

/** Restores every section to application defaults for this user. */
export async function resetSettings(userId: string): Promise<UserSettings> {
  const { DEFAULT_SETTINGS } = await import("@/lib/settingsDefaults");
  const next = structuredClone(DEFAULT_SETTINGS) as UserSettings;
  await upsertSettings(userId, next);
  return next;
}