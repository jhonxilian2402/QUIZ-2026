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
import { SelectField } from "@/components/ui/SelectField";
import { Slider } from "@/components/ui/Slider";
import { InfoIcon } from "@/components/ui/icons";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./FileSettings.module.css";

const RETENTION_OPTIONS: QuizOption<"session" | "30-days" | "until-deleted">[] = [
  { value: "session", label: "For this session", description: "Removed when the session ends." },
  { value: "30-days", label: "30 days", description: "Retained for a month." },
  {
    value: "until-deleted",
    label: "Until I delete it",
    description: "Kept until you remove it.",
  },
];

const LIMIT_MB_MIN = 1;
const LIMIT_MB_MAX = 128;

/**
 * Files section. Local preferences are separated from server limits, because
 * the two are enforced by different layers and only the local one exists today.
 */
export function FileSettings() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const files = settings.files;
  const dirty = dirtySections.includes("files");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.files}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Local preferences"
        description="Enforced by the interface before a file is used."
      >
        <SettingsRow
          title="Maximum file size"
          description="Files above this size are rejected in the browser."
          entryId="files.maxFileSizeMb"
          layout="stacked"
          control={
            <>
              <Slider
                label="Maximum size"
                min={LIMIT_MB_MIN}
                max={LIMIT_MB_MAX}
                value={files.maxFileSizeMb}
                onChange={(maxFileSizeMb) => update("files", { maxFileSizeMb })}
                formatValue={(value) => `${value} MB`}
                minLabel={`${LIMIT_MB_MIN} MB`}
                maxLabel={`${LIMIT_MB_MAX} MB`}
              />
              <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
                Server-side limits will be set by the backend and may be lower.
              </SettingsNote>
            </>
          }
        />

        <SettingsSwitchRow
          title="Warn on large files"
          description="Ask before accepting a file near the size limit."
          checked={files.warnOnLargeFiles}
          onChange={(warnOnLargeFiles) => update("files", { warnOnLargeFiles })}
          htmlFor="files-warn"
          entryId="files.warnOnLargeFiles"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Upload behaviour"
        description="How selected material is handled once uploads are connected."
      >
        <SettingsSwitchRow
          title="Auto attach"
          description="Attach newly selected files to the current context."
          checked={files.autoAttach}
          onChange={(autoAttach) => update("files", { autoAttach })}
          htmlFor="files-auto-attach"
          entryId="files.autoAttach"
        />

        <SettingsSwitchRow
          title="Extract text"
          description="Prefer readable text from documents over raw files."
          checked={files.extractText}
          onChange={(extractText) => update("files", { extractText })}
          htmlFor="files-extract"
          entryId="files.extractText"
        />

        <SettingsSwitchRow
          title="Keep original file"
          description="Retain the uploaded file alongside any extracted text."
          checked={files.keepOriginal}
          onChange={(keepOriginal) => update("files", { keepOriginal })}
          htmlFor="files-keep-original"
          entryId="files.keepOriginal"
        />

        <SettingsRow
          title="Retention"
          description="How long uploaded material should be kept."
          entryId="files.retention"
          layout="stacked"
          control={
            <SelectField
              label="Retention"
              options={RETENTION_OPTIONS}
              value={files.retention}
              onChange={(retention) => update("files", { retention })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Supported types"
        description="Recognised by the interface today. Processing depends on the backend."
      >
        <div className={styles.types}>
          {["PDF", "TXT", "MD", "DOC", "DOCX", "PPT", "PPTX", "PNG", "JPG", "WEBP"].map(
            (type) => (
              <span key={type} className={styles.type}>
                {type}
                <StatusPill tone="muted">Local</StatusPill>
              </span>
            )
          )}
        </div>
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Uploads, storage and text extraction are not implemented yet. These are
          local preferences only.
        </SettingsNote>
        <ResetSettingsDialog target="files" label="Reset Files" />
      </div>
    </SettingsSection>
  );
}