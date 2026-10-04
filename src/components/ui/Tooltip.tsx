"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Tooltip.module.css";

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "right";
  className?: string;
  /** Delay before showing, so incidental hovers do not flash tooltips. */
  delay?: number;
};

/**
 * Tooltip for unfamiliar, icon-only or advanced controls. It appears after a
 * short delay, on hover and keyboard focus, and never intercepts pointer
 * events.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
  delay = 350,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className={cn(styles.root, className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {open ? (
        <span role="tooltip" className={cn(styles.bubble, styles[side])}>
          {label}
        </span>
      ) : null}
    </span>
  );
}