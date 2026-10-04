import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import styles from "./settings-loading.module.css";

/**
 * Loading state for a settings section. Mirrors the real section frame so the
 * transition into content does not shift the layout.
 */
export default function SettingsSectionLoading() {
  return (
    <div className={styles.section} role="status" aria-label="Loading settings">
      <div className={styles.header}>
        <Skeleton width={148} height={22} radius="md" />
        <Skeleton width="min(420px, 70%)" height={12} />
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <Skeleton width={120} height={13} />
          <Skeleton width="min(280px, 60%)" height={11} />
        </div>
        <div className={styles.rows}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.row}>
              <div className={styles.rowText}>
                <Skeleton width={index % 2 === 0 ? 160 : 120} height={13} />
                <Skeleton width="min(340px, 80%)" height={11} />
              </div>
              <Skeleton width={88} height={28} radius="md" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonText lines={2} />
    </div>
  );
}