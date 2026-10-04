"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Switch.module.css";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

/**
 * Minimal toggle. The visual track is a span so the control stays crisp on
 * dark surfaces; all state lives in the real checkbox underneath.
 */
export function Switch({
  checked,
  onChange,
  id,
  disabled = false,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <span className={cn(styles.root, disabled && styles.disabled)}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.track} aria-hidden>
        <span className={styles.thumb} />
      </span>
    </span>
  );
}

type SwitchRowProps = {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  htmlFor?: string;
  trailing?: ReactNode;
};

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  htmlFor,
  trailing,
}: SwitchRowProps) {
  return (
    <div className={cn(styles.row, disabled && styles.rowDisabled)}>
      <div className={styles.text}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {description ? (
          <span className={styles.description}>{description}</span>
        ) : null}
      </div>
      {trailing}
      <Switch
        id={htmlFor}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={typeof label === "string" ? label : undefined}
      />
    </div>
  );
}