"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authService } from "@/lib/api/services";
import type { SessionUser } from "@/lib/api/contracts";
import { isUnauthorized } from "@/lib/api/client";

/**
 * Session context for the application shell.
 *
 * On mount it asks the server who the caller is. The shell uses this to decide
 * between the application and the sign-in screen, so protected areas are never
 * rendered on an unverified assumption. Authorization is still enforced by the
 * API on every request; this only controls what is shown.
 */

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  status: SessionStatus;
  user: SessionUser | null;
  /** True when the API could not be reached, as opposed to signed out. */
  unreachable: boolean;
  refresh: () => void;
  setUser: (user: SessionUser | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [nonce, setNonce] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    authService
      .session(controller.signal)
      .then((result) => {
        if (!mounted.current) return;
        setUnreachable(false);
        if (result.authenticated && result.user) {
          setUser(result.user);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!mounted.current) return;
        // A failed session check is treated as signed out. The shell is also
        // told the API was unreachable, so it can distinguish a connection
        // problem from a genuine signed-out state.
        setUnreachable(!isUnauthorized(error));
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => controller.abort();
  }, [nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, unreachable, refresh, setUser }),
    [status, user, unreachable, refresh]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}