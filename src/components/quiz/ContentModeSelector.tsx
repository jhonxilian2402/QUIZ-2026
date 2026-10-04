"use client";

import { CONTENT_MODE_OPTIONS } from "@/lib/quiz";
import { cn } from "@/lib/utils";
import type { QuizContentMode } from "@/types";
import styles from "./ContentModeSelector.module.css";

type ContentModeSelectorProps = {
  value: QuizContentMode;
  onChange: (mode: QuizContentMode) => void;
};

/**
 * Tab-like selector for the four content modes. The modes share one section
 * and only swap the inputs below, so switching never feels like leaving the
 * builder.
 */
export function ContentModeSelector({ value, onChange }: ContentModeSelectorProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Content mode">
      {CONTENT_MODE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(styles.tab, active && styles.active)}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.label}>{option.label}</span>
            {option.description ? (
              <span className={styles.description}>{option.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}