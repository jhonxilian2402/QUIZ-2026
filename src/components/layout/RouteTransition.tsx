"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./RouteTransition.module.css";

/**
 * Subtle content transition on route change.
 *
 * The subtree is keyed by path so each route animates in, and the effect is a
 * CSS animation with no timers. The very first paint is never animated, so the
 * initial load stays immediate, and reduced motion removes it entirely.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [view, setView] = useState({ key: pathname, animate: false });

  useEffect(() => {
    setView((current) =>
      current.key === pathname
        ? current
        : { key: pathname, animate: true }
    );
  }, [pathname]);

  return (
    <div
      key={view.key}
      className={cn(styles.enter, view.animate && styles.animate)}
    >
      {children}
    </div>
  );
}