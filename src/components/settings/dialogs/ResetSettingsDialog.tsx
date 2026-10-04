"use client";

import { useState } from "react";
import { useSettings, type ResetTarget } from "../SettingsProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { RefreshIcon } from "@/components/ui/icons";

type ResetSettingsDialogProps = {
  /** Section to reset, or "all" for every section. */
  target: ResetTarget;
  label: string;
};

/**
 * Reset dialog shared by section-level resets and the global restore action.
 * A global reset is treated as destructive; a section reset is lighter but
 * still confirmed, because it discards the current draft for that section.
 */
export function ResetSettingsDialog({ target, label }: ResetSettingsDialogProps) {
  const { reset, dirtySections } = useSettings();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);

  const isGlobal = target === "all";
  const affected = isGlobal
    ? dirtySections.length
    : dirtySections.filter((section) => section === target).length;

  return (
    <>
      <Button
        variant={isGlobal ? "danger" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
        leadingIcon={<RefreshIcon size={14} />}
      >
        {label}
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={isGlobal ? "Reset all settings?" : `Reset ${label}?`}
        description={
          isGlobal
            ? "Every section returns to the application defaults. This replaces your current draft and cannot be undone from here."
            : "This section returns to the application defaults. Other sections are left untouched."
        }
        confirmLabel={isGlobal ? "Reset everything" : "Reset section"}
        destructive={isGlobal}
        confirmDisabled={affected === 0}
        onConfirm={() => {
          reset(target);
          notify({
            tone: "success",
            title: isGlobal ? "All settings reset" : `${label} reset`,
            description: "Defaults restored on this device.",
          });
          return {
            message: isGlobal
              ? "All settings restored to defaults."
              : `${label} · restored to defaults.`,
          };
        }}
      />
    </>
  );
}