"use client";

import { useSettings } from "./SettingsProvider";
import { Button } from "@/components/ui/Button";
import { CheckCircleIcon } from "@/components/ui/icons";
import styles from "./SettingsUnsavedBar.module.css";

/**
 * Sticky status bar for the settings draft. It appears only while changes are
 * pending, distinguishes save from discard, and reports the honest state: the
 * values are applied locally, not persisted to a server.
 */
export function SettingsUnsavedBar() {
  const { dirty, save, discard, saveState, dirtySections, status } = useSettings();

  const visible = dirty || saveState === "saving" || saveState === "saved";
  if (!visible) return null;

  const label =
    saveState === "saving"
      ? "Saving to your account"
      : saveState === "saved"
        ? "Saved to your account"
        : `${dirtySections.length} section${dirtySections.length === 1 ? "" : "s"} with unsaved changes`;

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <div className={styles.info}>
        <span className={styles.dot} data-state={saveState} aria-hidden />
        <span className={styles.text}>{label}</span>
      </div>

      <div className={styles.actions}>
        {saveState === "saved" ? (
          <span className={styles.saved}>
            <CheckCircleIcon size={15} />
            Stored on your account.
          </span>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={discard}
              disabled={saveState === "saving" || !dirty}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              loading={saveState === "saving"}
              disabled={!dirty}
              title={
                status === "ready"
                  ? undefined
                  : "Sign in to store preferences on your account"
              }
            >
              Save changes
            </Button>
          </>
        )}
      </div>
    </div>
  );
}