"use client";

import { useState } from "react";
import { useSettings, type ResetTarget } from "../SettingsProvider";
import { useSettingsFocus } from "../useSettingsFocus";
import {
  SettingsGroup,
  SettingsNote,
  SettingsSection,
} from "../SettingsSection";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import {
  DownloadIcon,
  InfoIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import styles from "./DataManagement.module.css";

type DestructiveAction = {
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  unavailableReason: string;
};

const EXPORT_PARTS = [
  { id: "conversations", label: "Conversations", hint: "Message history." },
  { id: "quizzes", label: "Quizzes", hint: "Generated quizzes and results." },
  { id: "settings", label: "Settings", hint: "Your preferences." },
  { id: "account", label: "Account data", hint: "Profile and account record." },
];

const DESTRUCTIVE_ACTIONS: DestructiveAction[] = [
  {
    id: "conversations",
    title: "Delete conversations",
    description: "Remove every stored conversation from this account.",
    confirmLabel: "Delete conversations",
    unavailableReason:
      "Conversations are stored on your account. Bulk deletion arrives with the data-management phase; individual conversations can already be deleted from the sidebar.",
  },
  {
    id: "quiz-history",
    title: "Delete quiz history",
    description: "Remove past quizzes and their recorded results.",
    confirmLabel: "Delete quiz history",
    unavailableReason:
      "Quizzes are stored on your account. Bulk deletion arrives with the data-management phase.",
  },
  {
    id: "files",
    title: "Delete uploaded files",
    description: "Remove every file you have uploaded.",
    confirmLabel: "Delete files",
    unavailableReason:
      "Uploaded files are tracked on your account. Bulk deletion arrives with the data-management phase.",
  },
  {
    id: "local-preferences",
    title: "Clear local preferences",
    description: "Reset the preferences stored on this device.",
    confirmLabel: "Clear preferences",
    unavailableReason:
      "Preferences live on your account. Use “Reset everything” below to restore the application defaults.",
  },
  {
    id: "account",
    title: "Delete account",
    description: "Permanently remove the account and all associated content.",
    confirmLabel: "Delete account",
    unavailableReason:
      "Account deletion arrives with the data-management phase and will remove every stored resource with it.",
  },
];

/**
 * Data management section. Every action is real UI against a missing backend, so
 * each one states precisely why it is inactive instead of pretending to work.
 */
export function DataManagement() {
  const { reset, dirtySections } = useSettings();
  useSettingsFocus();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportParts, setExportParts] = useState<string[]>(["settings"]);
  const [activeAction, setActiveAction] = useState<DestructiveAction | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const togglePart = (id: string) =>
    setExportParts((parts) =>
      parts.includes(id) ? parts.filter((part) => part !== id) : [...parts, id]
    );

  return (
    <>
      <SettingsSection {...SETTINGS_SECTION_META.data}>
        <SettingsGroup
          title="Export"
          description="Prepare a copy of the content associated with your account."
        >
          <div className={styles.action}>
            <div className={styles.actionText}>
              <span className={styles.actionTitle}>
                <DownloadIcon size={15} />
                Export data
              </span>
              <span className={styles.actionDescription}>
                Choose what to include. Export files are produced by the
                data-management phase.
              </span>
            </div>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              Configure export
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Stored content"
          description="Remove content from this account. These actions are destructive."
        >
          {DESTRUCTIVE_ACTIONS.map((action) => (
            <div key={action.id} className={styles.action}>
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>
                  {action.title}
                  <StatusPill tone="danger">Destructive</StatusPill>
                </span>
                <span className={styles.actionDescription}>
                  {action.description}
                </span>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setActiveAction(action)}
                leadingIcon={<TrashIcon size={14} />}
              >
                {action.confirmLabel}
              </Button>
            </div>
          ))}
        </SettingsGroup>

        <SettingsGroup
          title="Local preferences"
          description="Reset the preferences held for this device."
        >
          <div className={cn(styles.action, styles.resetAction)}>
            <div className={styles.actionText}>
              <span className={styles.actionTitle}>Reset all settings</span>
              <span className={styles.actionDescription}>
                Returns every section to the application defaults. This is not
                the same as clearing local preferences.
              </span>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setResetOpen(true)}
              disabled={dirtySections.length === 0}
            >
              Reset everything
            </Button>
          </div>
        </SettingsGroup>

        <SettingsNote tone="warning" icon={<WarningIcon size={14} />}>
          Your data is stored on your account. Bulk destructive actions require
          confirmation and arrive with the data-management phase.
        </SettingsNote>
      </SettingsSection>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export data"
        description="Select the parts to include in the export."
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled>
              Prepare export
            </Button>
          </>
        }
      >
        <ul className={styles.exportList}>
          {EXPORT_PARTS.map((part) => (
            <li key={part.id} className={styles.exportItem}>
              <span className={styles.exportText}>
                <span className={styles.exportLabel}>{part.label}</span>
                <span className={styles.exportHint}>{part.hint}</span>
              </span>
              <Switch
                checked={exportParts.includes(part.id)}
                onChange={() => togglePart(part.id)}
                aria-label={`Include ${part.label}`}
              />
            </li>
          ))}
        </ul>

        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Export produces a downloadable file in the data-management phase. No
          file is generated yet.
        </SettingsNote>
      </Dialog>

      <ConfirmDialog
        open={activeAction !== null}
        onClose={() => setActiveAction(null)}
        title={activeAction?.title ?? ""}
        description={activeAction?.description ?? ""}
        confirmLabel={activeAction?.confirmLabel ?? "Confirm"}
        destructive
        unavailableReason={activeAction?.unavailableReason}
        onConfirm={() => ({ message: "Completed." })}
      />

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all settings?"
        description="Every section returns to the application defaults. Your current draft is discarded."
        confirmLabel="Reset everything"
        destructive
        onConfirm={() => {
          reset("all" as ResetTarget);
          return { message: "All settings restored to defaults." };
        }}
      />
    </>
  );
}