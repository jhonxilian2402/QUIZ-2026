/**
 * Deterministic conversation titles derived from the first user message.
 *
 * No extra AI request is made just for naming: a title is readable, safe and
 * cheap to compute, and the user can always rename the conversation.
 */

const MAX_TITLE_LENGTH = 60;

export function deriveTitle(content: string): string {
  // Collapse whitespace and strip common Markdown noise from the edges.
  const cleaned = content
    .replace(/[`*_#>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return "New conversation";

  if (cleaned.length <= MAX_TITLE_LENGTH) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Truncate at a word boundary so the title never ends mid-word.
  const window = cleaned.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = window.lastIndexOf(" ");
  const base = (lastSpace > MAX_TITLE_LENGTH * 0.5 ? window.slice(0, lastSpace) : window)
    .replace(/[\s.,;:!?…-]+$/, "");

  return base.charAt(0).toUpperCase() + base.slice(1) + "…";
}
