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
import { SelectField } from "@/components/ui/SelectField";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { InfoIcon } from "@/components/ui/icons";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./SearchSettings.module.css";

/**
 * Search section. Every provider is listed but none is connected, so the
 * section states that plainly rather than showing a live status.
 */
const PROVIDER_OPTIONS: QuizOption<string>[] = [
  { value: "", label: "Not configured" },
];

const DEPTH_OPTIONS: QuizOption<"quick" | "standard" | "deep">[] = [
  { value: "quick", label: "Quick" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
];

const SAFE_OPTIONS: QuizOption<"strict" | "moderate" | "off">[] = [
  { value: "strict", label: "Strict" },
  { value: "moderate", label: "Moderate" },
  { value: "off", label: "Off" },
];

export function SearchSettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const search = settings.search;
  const dirty = dirtySections.includes("search");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.search}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup title="Live web search">
        <SettingsSwitchRow
          title="Enable web research"
          description="Allow the assistant to consult external sources during research."
          checked={search.enabled}
          onChange={(enabled) => update("search", { enabled })}
          htmlFor="search-enabled"
          entryId="search.enabled"
        />

        <SettingsRow
          title="Search provider"
          description="Which external service should answer research queries."
          entryId="search.provider"
          layout="stacked"
          control={
            <>
              <div className={styles.providerRow}>
                <SelectField
                  label="Search provider"
                  placeholder="Not configured"
                  options={PROVIDER_OPTIONS}
                  value={search.provider}
                  onChange={(provider) => update("search", { provider })}
                  className={styles.providerSelect}
                />
                <StatusPill tone="muted" dot>
                  Not connected
                </StatusPill>
              </div>
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                No search provider is wired up in this phase. Provider
                connections are configured in API providers.
              </SettingsNote>
            </>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Results">
        <SettingsRow
          title="Number of results"
          description="How many sources to consider for a research request."
          entryId="search.resultCount"
          layout="stacked"
          control={
            <Slider
              label="Results per search"
              min={1}
              max={20}
              value={search.resultCount}
              onChange={(resultCount) => update("search", { resultCount })}
              formatValue={(value) => `${value} result${value === 1 ? "" : "s"}`}
            />
          }
        />

        <SettingsRow
          title="Research depth"
          description="How far a research task should be followed before answering."
          entryId="search.researchDepth"
          layout="stacked"
          control={
            <SegmentedControl
              name="Research depth"
              size="sm"
              options={DEPTH_OPTIONS}
              value={search.researchDepth}
              onChange={(researchDepth) => update("search", { researchDepth })}
            />
          }
        />

        <SettingsRow
          title="Safe search"
          description="Filtering level applied to results."
          entryId="search.safeSearch"
          layout="stacked"
          control={
            <SegmentedControl
              name="Safe search"
              size="sm"
              options={SAFE_OPTIONS}
              value={search.safeSearch}
              onChange={(safeSearch) => update("search", { safeSearch })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Sources">
        <SettingsSwitchRow
          title="Cite sources"
          description="Attach references to research answers."
          checked={search.citeSources}
          onChange={(citeSources) => update("search", { citeSources })}
          htmlFor="search-cite"
          entryId="search.citeSources"
        />

        <SettingsSwitchRow
          title="Open links in a new tab"
          description="Keep the workspace open when following a source."
          checked={search.openLinksInNewTab}
          onChange={(openLinksInNewTab) =>
            update("search", { openLinksInNewTab })
          }
          htmlFor="search-new-tab"
          entryId="search.openLinksInNewTab"
        />
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="warning" icon={<InfoIcon size={14} />}>
          Search is not connected. These preferences describe the intended
          behaviour and take effect once a provider is available.
        </SettingsNote>
        <div className={styles.footerActions}>
          <ResetSettingsDialog target="search" label="Reset Search" />
          <Button variant="subtle" size="sm" disabled>
            Connect provider
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}