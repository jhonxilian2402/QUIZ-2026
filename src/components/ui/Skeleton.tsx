import { cn } from "@/lib/utils";
import styles from "./Skeleton.module.css";

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  radius?: "sm" | "md" | "lg" | "full";
  className?: string;
};

/**
 * Skeleton placeholder for content that will arrive from a real request. It is
 * purely presentational and announces itself as busy to assistive technology.
 */
export function Skeleton({
  width,
  height,
  radius = "sm",
  className,
}: SkeletonProps) {
  return (
    <span
      className={cn(styles.skeleton, styles[radius], className)}
      style={{ width, height }}
      aria-hidden
    />
  );
}

type SkeletonTextProps = {
  lines?: number;
  className?: string;
};

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cn(styles.text, className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={12}
          width={index === lines - 1 ? "62%" : "100%"}
        />
      ))}
    </span>
  );
}

/**
 * Small indeterminate spinner. Size is controlled so it can sit inline in a
 * button or occupy a block region without dominating the page.
 */
export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(styles.spinner, className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}