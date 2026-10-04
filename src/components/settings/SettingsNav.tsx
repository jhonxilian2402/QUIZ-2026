"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_SECTIONS } from "@/lib/settingsDefaults";
import {
  BellIcon,
  DatabaseIcon,
  FileIcon,
  GraduationIcon,
  MessageIcon,
  PaletteIcon,
  PlugIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  TerminalIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { IconComponent, SettingsSectionId } from "@/types";
import { cn } from "@/lib/utils";
import styles from "./SettingsNav.module.css";

const SECTION_ICONS: Record<SettingsSectionId, IconComponent> = {
  profile: UserIcon,
  appearance: PaletteIcon,
  chat: MessageIcon,
  ai: SparkIcon,
  quiz: GraduationIcon,
  search: SearchIcon,
  files: FileIcon,
  notifications: BellIcon,
  privacy: ShieldIcon,
  data: DatabaseIcon,
  api: PlugIcon,
  advanced: TerminalIcon,
};

/**
 * Subordinate settings navigation. Destinations are real routes, so section
 * changes, refresh and browser back/forward all work without extra state.
 *
 * Desktop and tablet render the grouped vertical list; mobile collapses into a
 * horizontally scrollable row so the page never needs three columns.
 */
export function SettingsNav() {
  const pathname = usePathname();

  const groups: { label: string; items: typeof SETTINGS_SECTIONS }[] = [];
  for (const section of SETTINGS_SECTIONS) {
    const existing = groups.find((group) => group.label === section.group);
    if (existing) existing.items.push(section);
    else groups.push({ label: section.group, items: [section] });
  }

  const isActive = (id: string) =>
    pathname === `/settings/${id}` ||
    (id === "profile" && pathname === "/settings");

  return (
    <nav className={styles.root} aria-label="Settings">
      {groups.map((group) => (
        <div key={group.label} className={styles.group}>
          <span className={styles.groupLabel}>{group.label}</span>
          <ul className={styles.list}>
            {group.items.map((section) => {
              const active = isActive(section.id);
              const Icon = SECTION_ICONS[section.id];
              return (
                <li key={section.id}>
                  <Link
                    href={`/settings/${section.id}`}
                    className={cn(styles.item, active && styles.active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className={styles.icon}>
                      <Icon size={15} />
                    </span>
                    <span className={styles.label}>{section.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}