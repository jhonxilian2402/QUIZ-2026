"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import styles from "./Navigation.module.css";

type NavigationProps = {
  items: NavItem[];
  onNavigate?: () => void;
};

export function Navigation({ items, onNavigate }: NavigationProps) {
  const pathname = usePathname();

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className={cn(styles.item, active && styles.active)}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <span className={styles.icon}>
                <Icon size={16} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}