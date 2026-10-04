"use client";

import type { ReactNode } from "react";
import { useSession } from "./SessionProvider";
import { AuthScreen } from "./AuthScreen";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./AuthGate.module.css";

/**
 * Gate for the protected workspace.
 *
 * While the session is being resolved the shell shows a neutral placeholder
 * rather than flashing the sign-in screen, so an authenticated reload does not
 * appear to sign the user out. Authorization remains a server concern: this only
 * decides what to render.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, unreachable } = useSession();

  if (status === "loading") {
    return (
      <div className={styles.loading} role="status" aria-label="Checking session">
        <div className={styles.brand}>
          <Skeleton width={140} height={14} radius="md" />
        </div>
        <div className={styles.body}>
          <Skeleton width="min(420px, 70%)" height={24} radius="md" />
          <Skeleton width="min(320px, 55%)" height={12} />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <>
        {unreachable ? (
          <p className={styles.offlineNotice} role="status">
            Could not reach the server. You can still sign in when it is
            available.
          </p>
        ) : null}
        <AuthScreen />
      </>
    );
  }

  return <>{children}</>;
}