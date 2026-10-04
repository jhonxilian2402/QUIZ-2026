"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";
import {
  Dropdown,
  DropdownDivider,
  DropdownGroupLabel,
  DropdownItem,
} from "@/components/ui/Dropdown";
import type { QuizOption } from "@/types";
import styles from "./SelectField.module.css";

type SelectFieldProps<T extends string> = {
  options: QuizOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
  size?: "sm" | "md";
  align?: "start" | "end";
  footer?: string;
  disabled?: boolean;
  /** Text shown when nothing matches, including the "not selected" case. */
  placeholder?: string;
  /** Optional note rendered under the options, e.g. a support limitation. */
  note?: string;
};

/**
 * Dropdown-backed single select for enumerated settings. It reuses the shared
 * Dropdown so menus animate and dismiss consistently with the chat workspace.
 */
export function SelectField<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = "md",
  align = "start",
  footer,
  disabled = false,
  placeholder = "Select",
  note,
}: SelectFieldProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <Dropdown
      align={align}
      className={className}
      trigger={({ open }) => (
        <button
          type="button"
          className={cn(
            styles.trigger,
            size === "sm" && styles.sm,
            open && styles.triggerOpen,
            !selected && styles.placeholder,
            disabled && styles.disabled
          )}
          aria-label={label}
          disabled={disabled}
        >
          <span className={styles.value}>
            {selected?.label ?? placeholder}
          </span>
          <span className={styles.chevron}>
            <ChevronDownIcon size={14} />
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          {label ? <DropdownGroupLabel>{label}</DropdownGroupLabel> : null}
          {options.length === 0 ? (
            <DropdownItem disabled>{placeholder}</DropdownItem>
          ) : (
            options.map((option) => (
              <DropdownItem
                key={option.value}
                selected={option.value === value}
                meta={option.description}
                onSelect={() => {
                  onChange(option.value);
                  close();
                }}
              >
                {option.label}
              </DropdownItem>
            ))
          )}
          {note ? (
            <>
              <DropdownDivider />
              <DropdownItem disabled>{note}</DropdownItem>
            </>
          ) : null}
          {footer ? (
            <>
              <DropdownDivider />
              <DropdownItem disabled>{footer}</DropdownItem>
            </>
          ) : null}
        </>
      )}
    </Dropdown>
  );
}