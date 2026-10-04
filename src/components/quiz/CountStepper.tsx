"use client";

import { clamp, cn } from "@/lib/utils";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import styles from "./CountStepper.module.css";

type CountStepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * Bounded numeric field with explicit decrement/increment controls. The typed
 * input is sanitised on every change; the range is enforced by the caller's
 * min/max contract.
 */
export function CountStepper({
  value,
  min,
  max,
  onChange,
  id,
  ariaLabel,
  className,
}: CountStepperProps) {
  return (
    <div className={cn(styles.root, className)}>
      <button
        type="button"
        className={styles.button}
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1, min, max))}
      >
        <MinusIcon size={14} />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={styles.input}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, "");
          if (digits.length === 0) {
            onChange(min);
            return;
          }
          onChange(clamp(Number(digits), min, max));
        }}
      />
      <button
        type="button"
        className={styles.button}
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1, min, max))}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
}