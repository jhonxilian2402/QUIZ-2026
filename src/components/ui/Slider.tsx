"use client";

import { useId } from "react";
import { clamp } from "@/lib/utils";
import styles from "./Slider.module.css";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  /** Formats the current value for the readout, e.g. "40%" or "5 results". */
  formatValue?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
};

/**
 * Range control with an explicit readout. Used where a continuous or stepped
 * value is clearer than a select, such as creativity or result count.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  formatValue,
  minLabel,
  maxLabel,
  disabled = false,
}: SliderProps) {
  const id = useId();
  const readout = formatValue ? formatValue(value) : String(value);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <span className={styles.value}>{readout}</span>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {minLabel || maxLabel ? (
        <div className={styles.scale} aria-hidden>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}