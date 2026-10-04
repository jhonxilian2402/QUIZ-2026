"use client";

import { SOURCE_MODE_OPTIONS } from "@/lib/quiz";
import { cn } from "@/lib/utils";
import { CheckMark } from "@/components/ui/CheckMark";
import { DatabaseIcon, LayersIcon, SparkIcon } from "@/components/ui/icons";
import type { QuizSourceMode } from "@/types";
import styles from "./SourceModeSelector.module.css";

type SourceModeSelectorProps = {
  value: QuizSourceMode;
  onChange: (mode: QuizSourceMode) => void;
};

/**
 * Explicit three-way source picker. The active mode is always visible; the
 * mode never hides itself behind a secondary control.
 */
export function SourceModeSelector({ value, onChange }: SourceModeSelectorProps) {
  const icons: Record<QuizSourceMode, typeof SparkIcon> = {
    ai: SparkIcon,
    database: DatabaseIcon,
    mixed: LayersIcon,
  };

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Question source">
      {SOURCE_MODE_OPTIONS.map((option, index) => {
        const Icon = icons[option.value];
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={cn(styles.card, active && styles.active)}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.top}>
              <span className={styles.index}>{index + 1}</span>
              <span className={styles.icon}>
                <Icon size={16} />
              </span>
              {active ? <CheckMark className={styles.check} size={15} /> : null}
            </span>
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