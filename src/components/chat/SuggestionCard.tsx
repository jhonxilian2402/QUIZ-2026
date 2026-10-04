"use client";

import { cn } from "@/lib/utils";
import type { SuggestionCardData } from "@/types";
import styles from "./SuggestionCard.module.css";

type SuggestionCardProps = {
  card: SuggestionCardData;
  active?: boolean;
  onSelect?: (card: SuggestionCardData) => void;
};

export function SuggestionCard({
  card,
  active = false,
  onSelect,
}: SuggestionCardProps) {
  return (
    <button
      type="button"
      className={cn(styles.card, active && styles.active)}
      onClick={() => onSelect?.(card)}
    >
      <span className={styles.title}>{card.title}</span>
      <span className={styles.description}>{card.description}</span>
    </button>
  );
}