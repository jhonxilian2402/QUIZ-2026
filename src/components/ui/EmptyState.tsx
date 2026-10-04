import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Additional guidance, e.g. what to do first. */
  hint?: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Explains what is missing, why, and what the user can do next. Used for
 * genuine empty or unavailable states; it never implies data exists.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(styles.root, size === "sm" && styles.sm, className)}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        <p className={styles.description}>{description}</p>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}