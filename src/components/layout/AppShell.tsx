"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { RouteTransition } from "./RouteTransition";
import styles from "./AppShell.module.css";

type DrawerContextValue = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useSidebarDrawer(): DrawerContextValue {
  const value = useContext(DrawerContext);
  if (!value) {
    throw new Error("useSidebarDrawer must be used inside AppShell");
  }
  return value;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  const value = useMemo(
    () => ({ drawerOpen, openDrawer, closeDrawer }),
    [drawerOpen, openDrawer, closeDrawer]
  );

  return (
    <DrawerContext.Provider value={value}>
      <div className={styles.shell}>
        <Sidebar open={drawerOpen} onClose={closeDrawer} />
        <div
          className={cn(styles.scrim, drawerOpen && styles.scrimVisible)}
          onClick={closeDrawer}
          aria-hidden
        />
        <main className={styles.main}>
          <RouteTransition>
            <div className={styles.content}>{children}</div>
          </RouteTransition>
        </main>
      </div>
    </DrawerContext.Provider>
  );
}