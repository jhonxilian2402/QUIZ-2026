"use client";

import { cn } from "@/lib/utils";
import { CheckMark } from "./CheckMark";
import styles from "./SwatchPicker.module.css";

export type SwatchOption<T extends string> = {
  value: T;
  label: string;
  hex: string;
};

type SwatchPickerProps<T extends string> = {
  options: SwatchOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  className?: string;
};

/**
 * Controlled colour picker for a fixed preset list. Only curated, contrast-safe
 * values are offered, so personalization cannot break readability. The label is
 * always present next to the swatch rather than relying on colour alone.
 */
export function SwatchPicker<T extends string>({
  options,
  value,
  onChange,
  name,
  className,
}: SwatchPickerProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(styles.root, className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={cn(styles.option, active && styles.active)}
            onClick={() => onChange(option.value)}
          >
            <span
              className={styles.swatch}
              style={{ background: option.hex }}
              aria-hidden
            />
            <span className={styles.label}>{option.label}</span>
            <span className={styles.check}>
              {active ? <CheckMark size={14} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}