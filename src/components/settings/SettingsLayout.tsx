"use client";

import { SettingsNav } from "./SettingsNav";
import { SettingsSearch } from "./SettingsSearch";
import { SettingsUnsavedBar } from "./SettingsUnsavedBar";
import type { ReactNode } from "react";
import styles from "./SettingsLayout.module.css";

/**
 * Two-column settings workspace: a subordinate settings navigation and the
 * scrollable content area. The global application sidebar is owned by AppShell
 * and is intentionally not duplicated here.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.nav} aria-label="Settings sections">
        <SettingsSearch />
        <div className={styles.navScroll}>
          <SettingsNav />
        </div>
      </aside>

      <div className={styles.content}>
        <div className={styles.scroll}>
          <div className={styles.column}>{children}</div>
        </div>
        <SettingsUnsavedBar />
      </div>
    </div>
  );
}