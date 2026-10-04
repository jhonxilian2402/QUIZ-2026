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
import { SwatchPicker } from "@/components/ui/SwatchPicker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { InfoIcon } from "@/components/ui/icons";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_SCALE_OPTIONS,
  MOTION_OPTIONS,
  THEME_OPTIONS,
} from "@/lib/settingsDefaults";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import styles from "./AppearanceSettings.module.css";

/**
 * Appearance section. Every control writes to the shared appearance slice,
 * which SettingsProvider applies to the document, so changes are visible
 * immediately across the whole shell.
 */
export function AppearanceSettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const appearance = settings.appearance;
  const dirty = dirtySections.includes("appearance");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.appearance}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Theme and layout"
        description="Applied to the entire application."
      >
        <SettingsRow
          title="Theme"
          description="Dark is the primary appearance. Light uses a re-tuned palette rather than an inversion."
          entryId="appearance.theme"
          layout="stacked"
          control={
            <SegmentedControl
              name="Theme"
              size="sm"
              options={THEME_OPTIONS}
              value={appearance.theme}
              onChange={(theme) => update("appearance", { theme })}
            />
          }
        />

        <SettingsRow
          title="Interface density"
          description="Controls spacing across navigation, messages and forms."
          entryId="appearance.density"
          layout="stacked"
          control={
            <SegmentedControl
              name="Interface density"
              size="sm"
              options={DENSITY_OPTIONS}
              value={appearance.density}
              onChange={(density) => update("appearance", { density })}
            />
          }
        />

        <SettingsRow
          title="Font size"
          description="Scales typography without changing the layout structure."
          entryId="appearance.fontScale"
          layout="stacked"
          control={
            <SegmentedControl
              name="Font size"
              size="sm"
              options={FONT_SCALE_OPTIONS}
              value={appearance.fontScale}
              onChange={(fontScale) => update("appearance", { fontScale })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Accent">
        <SettingsRow
          title="Accent color"
          description="Affects active navigation, primary buttons, focus rings and selected states. Backgrounds stay neutral."
          entryId="appearance.accent"
          layout="stacked"
          control={
            <SwatchPicker
              name="Accent color"
              options={ACCENT_OPTIONS}
              value={appearance.accent}
              onChange={(accent) => update("appearance", { accent })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Accessibility"
        description="Motion follows your system setting regardless of the choice below."
      >
        <SettingsRow
          title="Animation"
          description="Full, reduced or minimal motion across the interface."
          entryId="appearance.motion"
          layout="stacked"
          control={
            <>
              <SelectField
                label="Animation"
                options={MOTION_OPTIONS}
                value={appearance.motion}
                onChange={(motion) => update("appearance", { motion })}
                className={styles.motionSelect}
              />
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                System-level “reduce motion” always overrides this preference.
              </SettingsNote>
            </>
          }
        />

        <SettingsSwitchRow
          title="Reduce transparency"
          description="Prefer solid surfaces over blurred overlays."
          checked={appearance.reduceTransparency}
          onChange={(reduceTransparency) =>
            update("appearance", { reduceTransparency })
          }
          htmlFor="appearance-transparency"
          entryId="appearance.reduceTransparency"
        />

        <SettingsSwitchRow
          title="High contrast"
          description="Increases separation between borders, surfaces and text."
          checked={appearance.highContrast}
          onChange={(highContrast) => update("appearance", { highContrast })}
          htmlFor="appearance-contrast"
          entryId="appearance.highContrast"
        />
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Changes apply to this device immediately. Persisting them per account
          becomes available once accounts are connected.
        </SettingsNote>
        <ResetSettingsDialog target="appearance" label="Reset Appearance" />
      </div>
    </SettingsSection>
  );
}