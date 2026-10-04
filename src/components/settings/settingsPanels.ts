import type { ComponentType } from "react";
import type { SettingsSectionId } from "@/types";
import { ProfileSettings } from "@/components/settings/profile/ProfileSettings";
import { AppearanceSettings } from "@/components/settings/appearance/AppearanceSettings";
import { ChatSettings } from "@/components/settings/chat/ChatSettings";
import { AISettings } from "@/components/settings/ai/AISettings";
import { QuizPreferences } from "@/components/settings/quiz/QuizPreferences";
import { SearchSettings } from "@/components/settings/search/SearchSettings";
import { FileSettings } from "@/components/settings/files/FileSettings";
import { NotificationSettings } from "@/components/settings/notifications/NotificationSettings";
import { PrivacySettings } from "@/components/settings/privacy/PrivacySettings";
import { DataManagement } from "@/components/settings/privacy/DataManagement";
import { APISettings } from "@/components/settings/api/APISettings";
import { AdvancedSettings } from "@/components/settings/advanced/AdvancedSettings";

/**
 * Maps a settings section id to its panel. The route layer stays trivial once
 * a new section: it is registered here and becomes navigable and searchable.
 */
export const SETTINGS_PANELS: Record<SettingsSectionId, ComponentType> = {
  profile: ProfileSettings,
  appearance: AppearanceSettings,
  chat: ChatSettings,
  ai: AISettings,
  quiz: QuizPreferences,
  search: SearchSettings,
  files: FileSettings,
  notifications: NotificationSettings,
  privacy: PrivacySettings,
  data: DataManagement,
  api: APISettings,
  advanced: AdvancedSettings,
};

export function isSettingsSection(value: string): value is SettingsSectionId {
  return value in SETTINGS_PANELS;
}