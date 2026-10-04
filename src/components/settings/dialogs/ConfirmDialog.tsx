"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  CheckCircleIcon,
  InfoIcon,
  RefreshIcon,
  WarningIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import styles from "./ConfirmDialog.module.css";

export type ConfirmOutcome = {
  /** Message shown once the operation resolves. */
  message: string;
};

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * When set, the action cannot run yet: confirm is disabled and the reason is
   * shown. Used for operations whose backend does not exist.
   */
  unavailableReason?: string;
  /** Runs on confirm. Resolve for success, reject for an error state. */
  onConfirm?: () => Promise<ConfirmOutcome> | ConfirmOutcome;
  /** Extra content, e.g. a confirmation input. */
  children?: ReactNode;
  /** Disables confirm until the caller's condition is met. */
  confirmDisabled?: boolean;
};

type Phase = "idle" | "working" | "success" | "error";

/**
 * Reusable confirmation dialog covering the full lifecycle: idle, working,
 * success and error. Destructive actions get a distinct treatment, and actions
 * that are not yet available are presented honestly rather than as failures.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  unavailableReason,
  onConfirm,
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setMessage("");
      setError("");
    }
  }, [open]);

  const run = async () => {
    if (!onConfirm) return;
    setPhase("working");
    setError("");
    try {
      const outcome = await onConfirm();
      setMessage(outcome?.message ?? "Done.");
      setPhase("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed.");
      setPhase("error");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={phase === "working"}
      footer={
        phase === "success" ? (
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={phase === "working"}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "danger" : "primary"}
              size="sm"
              onClick={run}
              loading={phase === "working"}
              disabled={
                phase === "working" || Boolean(unavailableReason) || confirmDisabled
              }
            >
              {confirmLabel}
            </Button>
          </>
        )
      }
    >
      <p className={styles.description}>{description}</p>

      {children ? <div className={styles.slot}>{children}</div> : null}

      {unavailableReason ? (
        <div className={cn(styles.banner, styles.bannerInfo)}>
          <InfoIcon size={15} />
          <div className={styles.bannerText}>
            <StatusPill tone="muted">Not available yet</StatusPill>
            <span>{unavailableReason}</span>
          </div>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className={cn(styles.banner, styles.bannerError)}>
          <WarningIcon size={15} />
          <div className={styles.bannerText}>
            <span className={styles.bannerTitle}>Could not complete</span>
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {phase === "success" ? (
        <div className={cn(styles.banner, styles.bannerSuccess)}>
          <CheckCircleIcon size={15} />
          <div className={styles.bannerText}>
            <span className={styles.bannerTitle}>Completed</span>
            <span>{message}</span>
          </div>
        </div>
      ) : null}

      {phase === "error" ? (
        <button type="button" className={styles.retry} onClick={run}>
          <RefreshIcon size={14} />
          Try again
        </button>
      ) : null}
    </Dialog>
  );
}