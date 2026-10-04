"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import styles from "./ProviderCard.module.css";

export type ProviderCardProps = {
  name: string;
  description: string;
  icon: ReactNode;
  statusLabel: string;
  statusTone: StatusTone;
  /** Primary configuration action label. */
  configureLabel?: string;
  onConfigure?: () => void;
  onTest?: () => void;
  onDisconnect?: () => void;
  /** Disables actions whose backend does not exist yet. */
  actionsDisabled?: boolean;
  /** Content revealed when the card is expanded. */
  body?: ReactNode;
  expanded?: boolean;
  badge?: ReactNode;
};

/**
 * Generic provider configuration card. One component serves every provider, so
 * adding OpenRouter, a search provider or a future service does not create a new
 * hardcoded component each time.
 */
export function ProviderCard({
  name,
  description,
  icon,
  statusLabel,
  statusTone,
  configureLabel = "Configure",
  onConfigure,
  onTest,
  onDisconnect,
  actionsDisabled = false,
  body,
  expanded = false,
  badge,
}: ProviderCardProps) {
  return (
    <div className={cn(styles.card, expanded && styles.expanded)}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>

        <div className={styles.text}>
          <div className={styles.titleRow}>
            <span className={styles.name}>{name}</span>
            {badge}
            <StatusPill tone={statusTone} dot>
              {statusLabel}
            </StatusPill>
          </div>
          <p className={styles.description}>{description}</p>
        </div>

        <div className={styles.actions}>
          {onTest ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTest}
              disabled={actionsDisabled}
            >
              Test connection
            </Button>
          ) : null}
          {onDisconnect ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              disabled={actionsDisabled}
            >
              Disconnect
            </Button>
          ) : null}
          {onConfigure ? (
            <Button
              variant={expanded ? "ghost" : "subtle"}
              size="sm"
              onClick={onConfigure}
              aria-expanded={expanded}
            >
              {expanded ? "Close" : configureLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {expanded && body ? <div className={styles.body}>{body}</div> : null}
    </div>
  );
}