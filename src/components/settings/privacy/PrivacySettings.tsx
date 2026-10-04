"use client";

import { useSettings } from "../SettingsProvider";
import { useSettingsFocus } from "../useSettingsFocus";
import {
  SettingsGroup,
  SettingsNote,
  SettingsSection,
  SettingsSwitchRow,
} from "../SettingsSection";
import { ResetSettingsDialog } from "../dialogs/ResetSettingsDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { InfoIcon } from "@/components/ui/icons";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import styles from "./PrivacySettings.module.css";

/**
 * Privacy section. Deliberately neutral wording: it describes the intent behind
 * each control without making legal or security claims that no backend
 * currently guarantees.
 */
export function PrivacySettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const privacy = settings.privacy;
  const dirty = dirtySections.includes("privacy");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.privacy}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Stored content"
        description="What this application should keep about your activity."
      >
        <SettingsSwitchRow
          title="Conversation history"
          description="Keep conversations available in the sidebar."
          checked={privacy.storeConversationHistory}
          onChange={(storeConversationHistory) =>
            update("privacy", { storeConversationHistory })
          }
          htmlFor="privacy-conversations"
          entryId="privacy.storeConversationHistory"
        />

        <SettingsSwitchRow
          title="Quiz history"
          description="Keep past quizzes and their results available."
          checked={privacy.storeQuizHistory}
          onChange={(storeQuizHistory) =>
            update("privacy", { storeQuizHistory })
          }
          htmlFor="privacy-quiz"
          entryId="privacy.storeQuizHistory"
        />

        <SettingsSwitchRow
          title="Saved files"
          description="Keep uploaded material after a session ends."
          checked={privacy.keepUploadedFiles}
          onChange={(keepUploadedFiles) =>
            update("privacy", { keepUploadedFiles })
          }
          htmlFor="privacy-files"
          entryId="privacy.keepUploadedFiles"
        />

        <SettingsSwitchRow
          title="Search history"
          description="Keep a record of research queries."
          checked={privacy.keepSearchHistory}
          onChange={(keepSearchHistory) =>
            update("privacy", { keepSearchHistory })
          }
          htmlFor="privacy-search"
          entryId="privacy.keepSearchHistory"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Usage"
        description="How your activity may inform the experience."
      >
        <SettingsSwitchRow
          title="Personalization"
          description="Let the workspace adapt to how you use it."
          checked={privacy.allowPersonalization}
          onChange={(allowPersonalization) =>
            update("privacy", { allowPersonalization })
          }
          htmlFor="privacy-personalization"
          entryId="privacy.allowPersonalization"
        />

        <SettingsSwitchRow
          title="Analytics"
          description="Allow anonymous measurement of feature usage."
          checked={privacy.allowAnalytics}
          onChange={(allowAnalytics) => update("privacy", { allowAnalytics })}
          htmlFor="privacy-analytics"
          entryId="privacy.allowAnalytics"
        />

        <SettingsSwitchRow
          title="Model improvement"
          description="Allow your content to be used to improve models."
          checked={privacy.allowModelImprovement}
          onChange={(allowModelImprovement) =>
            update("privacy", { allowModelImprovement })
          }
          htmlFor="privacy-improvement"
          entryId="privacy.allowModelImprovement"
        />
      </SettingsGroup>

      <SettingsGroup title="Session behaviour">
        <SettingsSwitchRow
          title="Incognito mode"
          description="Avoid retaining session content by default."
          checked={privacy.incognitoMode}
          onChange={(incognitoMode) => update("privacy", { incognitoMode })}
          htmlFor="privacy-incognito"
          entryId="privacy.incognitoMode"
        />

        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Controls how your data is handled by this application. No storage,
          analytics or model-training service is connected yet, so these
          preferences do not currently change server behaviour.
        </SettingsNote>
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Wording here describes intent, not a guarantee. Specific policies will
          be connected once the backend exists.
        </SettingsNote>
        <ResetSettingsDialog target="privacy" label="Reset Privacy" />
      </div>
    </SettingsSection>
  );
}