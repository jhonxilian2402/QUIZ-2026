"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";
import { MenuIcon } from "@/components/ui/icons";
import styles from "./QuizHeader.module.css";

type QuizHeaderProps = {
  title: string;
  description: string;
  meta?: string[];
  onOpenDrawer?: () => void;
  drawerOpen?: boolean;
  children?: ReactNode;
};

/**
 * Workspace header. It stays inside the same visual language as the chat
 * topbar: a compact row with the section label and quiet metadata.
 */
export function QuizHeader({
  title,
  description,
  meta = [],
  onOpenDrawer,
  drawerOpen = false,
  children,
}: QuizHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {onOpenDrawer ? (
          <IconButton
            label="Open navigation"
            size="sm"
            className={styles.drawerButton}
            onClick={onOpenDrawer}
            aria-expanded={drawerOpen}
          >
            <MenuIcon size={16} />
          </IconButton>
        ) : null}
        <div className={styles.text}>
          <span className={styles.eyebrow}>Quiz workspace</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
          {meta.length > 0 ? (
            <ul className={styles.meta}>
              {meta.map((item) => (
                <li key={item} className={styles.metaItem}>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </header>
  );
}

export function QuizHeaderBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
}) {
  return (
    <span className={cn(styles.badge, tone === "accent" && styles.badgeAccent)}>
      {children}
    </span>
  );
}