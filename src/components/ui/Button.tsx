"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Skeleton";
import styles from "./Button.module.css";

type ButtonVariant = "solid" | "ghost" | "outline" | "subtle" | "primary" | "danger";
type ButtonSize = "xs" | "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Shows a spinner and blocks interaction while an action is running. */
  loading?: boolean;
};

export function Button({
  variant = "solid",
  size = "md",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.root,
        styles[variant],
        size !== "md" && styles[size],
        fullWidth && styles.full,
        loading && styles.loading,
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={size === "xs" ? 12 : 14} /> : leadingIcon}
      {children}
      {loading ? null : trailingIcon}
    </button>
  );
}