"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
  fieldClassName?: string;
};

export function Input({
  leadingIcon,
  trailing,
  invalid = false,
  fieldClassName,
  className,
  ...props
}: InputProps) {
  return (
    <div className={cn(styles.field, invalid && styles.invalid, fieldClassName)}>
      {leadingIcon ? <span className={styles.icon}>{leadingIcon}</span> : null}
      <input className={cn(styles.input, className)} {...props} />
      {trailing ? <span className={styles.affix}>{trailing}</span> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className={styles.kbd}>{children}</span>;
}