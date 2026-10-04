import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Safe Markdown rendering for AI output.
 *
 * AI responses are untrusted input: Markdown is parsed to HTML and then
 * sanitized, so scripts, event handlers and dangerous URL schemes can never
 * reach the DOM. Code is only ever displayed, never executed.
 */

marked.setOptions({
  gfm: true,
  // Single line breaks in chat messages read like chat, not like documents.
  breaks: true,
});

const PURIFY_CONFIG = {
  // Only web-safe link schemes; javascript: and data: are dropped.
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  ADD_ATTR: ["target", "rel"],
};

export function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false });
  const sanitized = DOMPurify.sanitize(html, PURIFY_CONFIG);
  // External links open safely in a new tab.
  return sanitized.replace(
    /<a\s+/g,
    '<a target="_blank" rel="noopener noreferrer" '
  );
}
