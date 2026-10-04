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
import styles from "./NotificationSettings.module.css";

/**
 * Notifications section. Only events with a real future surface are listed, so
 * the section stays purposeful instead of accumulating categories.
 */
export function NotificationSettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const notifications = settings.notifications;
  const dirty = dirtySections.includes("notifications");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.notifications}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Activity"
        description="Events triggered by your own work in the workspace."
      >
        <SettingsSwitchRow
          title="Quiz completion"
          description="Notify when a quiz attempt finishes."
          checked={notifications.quizCompleted}
          onChange={(quizCompleted) => update("notifications", { quizCompleted })}
          htmlFor="notif-quiz"
          entryId="notifications.quizCompleted"
        />

        <SettingsSwitchRow
          title="Generation completion"
          description="Notify when a longer generation task finishes."
          checked={notifications.generationCompleted}
          onChange={(generationCompleted) =>
            update("notifications", { generationCompleted })
          }
          htmlFor="notif-generation"
          entryId="notifications.generationCompleted"
        />

        <SettingsSwitchRow
          title="Errors"
          description="Notify when a request or task fails."
          checked={notifications.errors}
          onChange={(errors) => update("notifications", { errors })}
          htmlFor="notif-errors"
          entryId="notifications.errors"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Account and product"
        description="Messages initiated by the application rather than by you."
      >
        <SettingsSwitchRow
          title="Account notifications"
          description="Important changes related to your account."
          checked={notifications.accountUpdates}
          onChange={(accountUpdates) =>
            update("notifications", { accountUpdates })
          }
          htmlFor="notif-account"
          entryId="notifications.accountUpdates"
        />

        <SettingsSwitchRow
          title="Product updates"
          description="Occasional news about new capabilities."
          checked={notifications.productUpdates}
          onChange={(productUpdates) =>
            update("notifications", { productUpdates })
          }
          htmlFor="notif-product"
          entryId="notifications.productUpdates"
        />
      </SettingsGroup>

      <SettingsGroup title="Delivery">
        <SettingsSwitchRow
          title="Sound"
          description="Play a soft sound with in-app notifications."
          checked={notifications.soundEnabled}
          onChange={(soundEnabled) => update("notifications", { soundEnabled })}
          htmlFor="notif-sound"
          entryId="notifications.soundEnabled"
        />

        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Notifications are delivered inside the workspace. Email and push
          delivery depend on a backend and are not available yet.
        </SettingsNote>
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          With no notification service connected, these preferences are stored
          locally and applied when one exists.
        </SettingsNote>
        <ResetSettingsDialog target="notifications" label="Reset Notifications" />
      </div>
    </SettingsSection>
  );
}