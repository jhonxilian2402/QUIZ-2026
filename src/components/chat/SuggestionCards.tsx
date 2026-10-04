import type { SuggestionCardData } from "@/types";
import { SuggestionCard } from "./SuggestionCard";
import styles from "./SuggestionCards.module.css";

type SuggestionCardsProps = {
  cards: SuggestionCardData[];
  activeId?: string | null;
  onSelect?: (card: SuggestionCardData) => void;
};

/**
 * Static-hosted starter list. Cards remain a plain list so they can be fed by
 * a dynamic source later.
 */
export function SuggestionCards({
  cards,
  activeId = null,
  onSelect,
}: SuggestionCardsProps) {
  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <SuggestionCard
          key={card.id}
          card={card}
          active={card.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}