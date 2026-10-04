import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./SectionCard.module.css";

type SectionCardProps = {
  id: string;
  index?: number;
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Shared section shell for the builder. Each block is visually delimited so
 * the page reads as a sequence of decisions rather than one long form.
 */
export function SectionCard({
  id,
  index,
  title,
  description,
  badge,
  action,
  className,
  children,
}: SectionCardProps) {
  return (
    <section id={id} className={cn(styles.section, className)} aria-labelledby={`${id}-title`}>
      <header className={styles.head}>
        <div className={styles.titleGroup}>
          {typeof index === "number" ? (
            <span className={styles.index} aria-hidden>
              {String(index).padStart(2, "0")}
            </span>
          ) : null}
          <div className={styles.text}>
            <h2 id={`${id}-title`} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>
        </div>
        <div className={styles.action}>
          {badge}
          {action}
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}