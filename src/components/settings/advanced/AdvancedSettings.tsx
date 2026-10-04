"use client";

import { useSettings } from "../SettingsProvider";
import { useSettingsFocus } from "../useSettingsFocus";
import {
  SettingsGroup,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from "../SettingsSection";
import { ResetSettingsDialog } from "../dialogs/ResetSettingsDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { InfoIcon, WarningIcon } from "@/components/ui/icons";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./AdvancedSettings.module.css";

const CACHE_OPTIONS: QuizOption<"default" | "aggressive" | "off">[] = [
  { value: "default", label: "Default" },
  { value: "aggressive", label: "Aggressive" },
  { value: "off", label: "Off" },
];

const PERFORMANCE_OPTIONS: QuizOption<"auto" | "quality" | "speed">[] = [
  { value: "auto", label: "Auto" },
  { value: "quality", label: "Quality" },
  { value: "speed", label: "Speed" },
];

/**
 * Advanced section. Diagnostics are grouped away from normal settings, and
 * experimental features are explicitly labelled rather than silently enabled.
 */
export function AdvancedSettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const advanced = settings.advanced;
  const dirty = dirtySections.includes("advanced");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.advanced}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Diagnostics"
        description="Additional detail for troubleshooting. Safe to leave off."
      >
        <SettingsSwitchRow
          title="Developer mode"
          description="Reveal extra diagnostics and internal identifiers in the interface."
          checked={advanced.developerMode}
          onChange={(developerMode) => update("advanced", { developerMode })}
          htmlFor="advanced-developer"
          entryId="advanced.developerMode"
        />

        <SettingsSwitchRow
          title="Debug information"
          description="Show request identifiers and timing details alongside results."
          checked={advanced.showDebugInfo}
          onChange={(showDebugInfo) => update("advanced", { showDebugInfo })}
          htmlFor="advanced-debug"
          entryId="advanced.showDebugInfo"
          disabled={!advanced.developerMode}
        />

        <SettingsSwitchRow
          title="Verbose errors"
          description="Include technical detail in error messages."
          checked={advanced.verboseErrors}
          onChange={(verboseErrors) => update("advanced", { verboseErrors })}
          htmlFor="advanced-verbose"
          entryId="advanced.verboseErrors"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Behaviour"
        description="How the workspace balances responsiveness and cost."
      >
        <SettingsRow
          title="Cache behaviour"
          description="How aggressively responses are reused before a new request."
          entryId="advanced.cacheBehavior"
          layout="stacked"
          control={
            <SegmentedControl
              name="Cache behaviour"
              size="sm"
              options={CACHE_OPTIONS}
              value={advanced.cacheBehavior}
              onChange={(cacheBehavior) => update("advanced", { cacheBehavior })}
            />
          }
        />

        <SettingsRow
          title="Performance mode"
          description="Balance answer quality against response speed."
          entryId="advanced.performanceMode"
          layout="stacked"
          control={
            <SegmentedControl
              name="Performance mode"
              size="sm"
              options={PERFORMANCE_OPTIONS}
              value={advanced.performanceMode}
              onChange={(performanceMode) =>
                update("advanced", { performanceMode })
              }
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Experimental"
        description="Features still in development. Expect them to change or break."
      >
        <SettingsSwitchRow
          title="Quiz import"
          description="Import quiz material from external file formats in the builder."
          checked={advanced.experimentalQuizImport}
          onChange={(experimentalQuizImport) =>
            update("advanced", { experimentalQuizImport })
          }
          htmlFor="advanced-quiz-import"
          entryId="advanced.experimentalQuizImport"
          experimental
        />

        <SettingsSwitchRow
          title="Multi-model"
          description="Compare responses from more than one model side by side."
          checked={advanced.experimentalMultiModel}
          onChange={(experimentalMultiModel) =>
            update("advanced", { experimentalMultiModel })
          }
          htmlFor="advanced-multi-model"
          entryId="advanced.experimentalMultiModel"
          experimental
        />

        <SettingsNote tone="warning" icon={<WarningIcon size={14} />}>
          Experimental features are off by default and may not function until
          their underlying services are connected.
        </SettingsNote>
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Advanced settings change how the workspace behaves. Reset them if a
          change makes the application harder to use.
        </SettingsNote>
        <ResetSettingsDialog target="advanced" label="Reset Advanced" />
      </div>
    </SettingsSection>
  );
}