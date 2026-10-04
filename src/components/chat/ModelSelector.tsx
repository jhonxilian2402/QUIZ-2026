"use client";

import { ChevronDownIcon } from "@/components/ui/icons";
import {
  Dropdown,
  DropdownDivider,
  DropdownEmpty,
  DropdownGroupLabel,
  DropdownItem,
} from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils";
import type { SelectableModel } from "@/types";
import styles from "./ModelSelector.module.css";

type ModelSelectorProps = {
  /** Live model list supplied by the caller. */
  models: SelectableModel[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

/**
 * Compact model selector. It only knows about the list it is handed, so the
 * live provider catalogue drives it without touching the component.
 */
export function ModelSelector({
  models,
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const selected = models.find((model) => model.id === value);

  return (
    <Dropdown
      align="start"
      trigger={({ open }) => (
        <button
          type="button"
          className={cn(styles.trigger, open && styles.triggerOpen)}
          disabled={disabled}
          aria-label="Select model"
        >
          <span className={styles.name}>
            {selected?.name ?? "Automatic"}
          </span>
          <span className={styles.chevron}>
            <ChevronDownIcon size={14} />
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <DropdownGroupLabel>Model</DropdownGroupLabel>
          {models.length === 0 ? (
            <DropdownEmpty>Model list unavailable.</DropdownEmpty>
          ) : (
            models.map((model) => (
              <DropdownItem
                key={model.id}
                selected={model.id === value}
                meta={model.description}
                onSelect={() => {
                  onChange(model.id);
                  close();
                }}
              >
                {model.name}
              </DropdownItem>
            ))
          )}
          <DropdownDivider />
          <DropdownItem disabled meta="Managed in Settings">
            Manage models
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}