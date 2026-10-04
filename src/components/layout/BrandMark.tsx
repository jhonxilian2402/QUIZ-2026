import type { IconProps } from "@/types";

/**
 * Wordmark glyph for the product name. Simple geometric mark with the same
 * visual weight as the reference logo.
 */
export function BrandMark({ size = 22, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path
        d="M4.2 19.6 11.05 4.4h1.9L19.8 19.6h-3.1l-1.55-3.6H8.85L7.3 19.6z"
        fill="currentColor"
        fillOpacity="0.92"
      />
      <path d="M13.05 12.9h-2.1l1.05-2.6z" fill="var(--sidebar-background)" />
    </svg>
  );
}