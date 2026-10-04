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
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { CloseIcon } from "@/components/ui/icons";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Errors stay longer. */
  duration?: number;
};

type ToastRecord = ToastInput & { id: number };

type ToastContextValue = {
  notify: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

const MAX_TOASTS = 3;

/**
 * Standardized, accessible notifications.
 *
 * Toasts stack briefly in a fixed corner, are dismissible, and rely on a polite
 * live region for assistive technology. They are used sparingly for real local
 * actions only.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = ++idRef.current;
      const record: ToastRecord = {
        duration: toast.tone === "error" ? 7000 : 4000,
        ...toast,
        id,
      };
      setToasts((current) => [...current, record].slice(-MAX_TOASTS));
      const timer = setTimeout(() => dismiss(id), record.duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0
        ? createPortal(
            <div
              className={styles.viewport}
              role="region"
              aria-label="Notifications"
            >
              <div aria-live="polite" aria-atomic="false" className={styles.stack}>
                {toasts.map((toast) => (
                  <div
                    key={toast.id}
                    className={cn(styles.toast, styles[toast.tone ?? "info"])}
                  >
                    <span className={styles.dot} aria-hidden />
                    <div className={styles.text}>
                      <span className={styles.title}>{toast.title}</span>
                      {toast.description ? (
                        <span className={styles.description}>
                          {toast.description}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={styles.close}
                      onClick={() => dismiss(toast.id)}
                      aria-label="Dismiss notification"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}