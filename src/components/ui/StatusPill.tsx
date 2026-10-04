import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./StatusPill.module.css";

export type StatusTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";

type StatusPillProps = {
  children: ReactNode;
  tone?: StatusTone;
  /** Renders a leading dot; the label always carries the meaning too. */
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
};

/**
 * Small honest-state label used for connection, availability and phase
 * indicators. Tone is decorative: the text always states the real status, so a
 * colour is never the only signal.
 */
export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
  icon,
  className,
}: StatusPillProps) {
  return (
    <span className={cn(styles.pill, styles[tone], className)}>
      {dot ? <span className={styles.dot} aria-hidden /> : null}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {children}
    </span>
  );
}