/**
 * Minimal class-name joiner. Keeps the component layer dependency-free.
 */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Clamps a numeric value between a lower and an upper bound.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Splits a greeting into its two display lines without hardcoding copy
 * inside the presentation components.
 */
export function splitGreeting(greeting: string): string[] {
  const [first, ...rest] = greeting.split("\n");
  return rest.length > 0 ? [first, rest.join("\n")] : [first];
}