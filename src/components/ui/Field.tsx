import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Field.module.css";

type FieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
};

/**
 * Label / hint / error wrapper shared by every form input in the application,
 * so spacing and typography stay identical across quiz and settings.
 */
export function Field({
  label,
  hint,
  required = false,
  htmlFor,
  error,
  className,
  children,
  action,
}: FieldProps) {
  return (
    <div className={cn(styles.field, className)}>
      <div className={styles.head}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className={styles.required} aria-hidden>
              *
            </span>
          ) : null}
        </label>
        {action}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {children}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}