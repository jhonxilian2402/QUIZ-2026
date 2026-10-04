"use client";

import { cn } from "@/lib/utils";
import { CheckMark } from "@/components/ui/CheckMark";
import { StatusPill } from "@/components/ui/StatusPill";
import { CAPABILITY_LABELS } from "@/lib/modelCatalogue";
import type { ModelInfo } from "@/types";
import styles from "./ModelPreferenceRow.module.css";

type ModelPreferenceRowProps = {
  model: ModelInfo;
  selected: boolean;
  onSelect: () => void;
  /** Optional badge such as "Default" or "Fallback". */
  role?: string;
  disabled?: boolean;
};

/**
 * Informative model row for Settings. It renders exactly the metadata it is
 * handed: capabilities are only shown when the provider reports them, and
 * availability is never implied.
 */
export function ModelPreferenceRow({
  model,
  selected,
  onSelect,
  role,
  disabled = false,
}: ModelPreferenceRowProps) {
  return (
    <button
      type="button"
      className={cn(styles.row, selected && styles.selected)}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className={styles.mark}>
        {selected ? <CheckMark size={14} /> : null}
      </span>

      <span className={styles.main}>
        <span className={styles.titleRow}>
          <span className={styles.name}>{model.name}</span>
          {role ? <StatusPill tone="accent">{role}</StatusPill> : null}
          <StatusPill tone="muted">{model.tier === "free" ? "Free" : "Paid"}</StatusPill>
          {!model.available ? (
            <StatusPill tone="muted">Unavailable</StatusPill>
          ) : null}
        </span>

        <span className={styles.metaRow}>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Provider</span>
            {model.provider}
          </span>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Context</span>
            {model.contextLabel}
          </span>
        </span>

        <span className={styles.capabilities}>
          <span className={styles.metaLabel}>Capabilities</span>
          {model.capabilities.length === 0 ? (
            <span className={styles.none}>None reported</span>
          ) : (
            model.capabilities.map((capability) => (
              <span key={capability} className={styles.chip}>
                {CAPABILITY_LABELS[capability]}
              </span>
            ))
          )}
        </span>
      </span>
    </button>
  );
}