import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./quiz-loading.module.css";

/**
 * Loading state for the Quiz workspace. It reflects the builder's block
 * sequence so the layout does not jump when the panel mounts.
 */
export default function QuizLoading() {
  return (
    <div className={styles.workspace} role="status" aria-label="Loading quiz workspace">
      <div className={styles.column}>
        <div className={styles.header}>
          <Skeleton width={132} height={11} />
          <Skeleton width={220} height={24} radius="md" />
          <Skeleton width="min(480px, 80%)" height={12} />
        </div>

        <Skeleton height={122} radius="lg" />

        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.block}>
            <div className={styles.blockHead}>
              <Skeleton width={168} height={14} />
              <Skeleton width={96} height={11} />
            </div>
            <div className={styles.blockBody}>
              <Skeleton height={34} radius="md" />
              <Skeleton width="70%" height={34} radius="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}