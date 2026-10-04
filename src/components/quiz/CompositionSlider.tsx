"use client";

import { DatabaseIcon, SparkIcon } from "@/components/ui/icons";
import styles from "./CompositionSlider.module.css";

type CompositionSliderProps = {
  value: number;
  onChange: (value: number) => void;
  total: number;
};

/**
 * Mixed-source composition control. The slider only describes the intended
 * split; nothing is retrieved or generated in this phase.
 */
export function CompositionSlider({ value, onChange, total }: CompositionSliderProps) {
  const databaseCount = Math.round((value / 100) * total);
  const aiCount = total - databaseCount;

  return (
    <div className={styles.root}>
      <div className={styles.legs}>
        <span className={styles.leg}>
          <span className={styles.legIcon}>
            <DatabaseIcon size={15} />
          </span>
          <span className={styles.legText}>
            <span className={styles.legLabel}>Database</span>
            <span className={styles.legValue}>{databaseCount} questions</span>
          </span>
        </span>
        <span className={styles.leg}>
          <span className={styles.legIcon}>
            <SparkIcon size={15} />
          </span>
          <span className={styles.legText}>
            <span className={styles.legLabel}>AI generated</span>
            <span className={styles.legValue}>{aiCount} questions</span>
          </span>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={styles.range}
        aria-label="Database and AI composition"
      />

      <div className={styles.track} aria-hidden>
        <span className={styles.trackDatabase} style={{ width: `${value}%` }} />
        <span className={styles.trackAi} style={{ width: `${100 - value}%` }} />
      </div>
    </div>
  );
}