"use client";

import { APP_NAME } from "@/lib/content";
import { NAV_ITEMS } from "@/lib/navigation";
import { BrandMark } from "./BrandMark";
import { ConversationHistory } from "./ConversationHistory";
import { Navigation } from "./Navigation";
import { SidebarSearch } from "./SidebarSearch";
import { UserProfile } from "./UserProfile";
import styles from "./Sidebar.module.css";
import { cn } from "@/lib/utils";

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  return (
    <aside
      className={cn(styles.sidebar, open && styles.drawerOpen)}
      aria-label="Primary"
    >
      <div className={styles.brand}>
        <span className={styles.brandMark}>
          <BrandMark />
        </span>
        <span className={styles.brandName}>{APP_NAME}</span>
      </div>

      <div className={styles.search}>
        <SidebarSearch shortcut="⌘ K" />
      </div>

      <nav className={styles.nav} aria-label="Main">
        <Navigation items={NAV_ITEMS} onNavigate={onClose} />
      </nav>

      <div className={styles.history}>
        <ConversationHistory />
      </div>

      <div className={styles.footer}>
        <UserProfile />
      </div>
    </aside>
  );
}