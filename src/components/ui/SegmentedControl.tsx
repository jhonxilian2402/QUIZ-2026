"use client";

import { cn } from "@/lib/utils";
import type { QuizOption } from "@/types";
import styles from "./SegmentedControl.module.css";

type SegmentedControlProps<T extends string> = {
  options: QuizOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
};

/**
 * Compact radio group used for bounded choices. It degrades to wrapped
 * buttons, so long option labels never force the row to overflow.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  name,
  size = "md",
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        styles.group,
        size === "sm" && styles.sm,
        fullWidth && styles.full,
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.description}
            className={cn(styles.option, active && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}