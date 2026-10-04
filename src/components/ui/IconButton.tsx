"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./IconButton.module.css";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  active?: boolean;
  children: ReactNode;
};

export function IconButton({
  label,
  size = "md",
  variant = "ghost",
  active = false,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        styles.root,
        styles[variant],
        size !== "md" && styles[size],
        active && styles.active,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}