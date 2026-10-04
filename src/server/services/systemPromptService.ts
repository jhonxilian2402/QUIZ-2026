import type { UserSettings } from "@/lib/api/contracts";

/**
 * System prompt service.
 *
 * The single place where the assistant's standing instructions are built.
 * React components never see this text, and providers receive it as a normal
 * system message. Later phases extend the context (subject, level, documents,
 * research) here instead of scattering prompt logic across the codebase.
 */

const PROMPT_VERSION = "tutor-v1";

const BASE_INSTRUCTIONS = [
  "You are Axora, an AI study tutor inside a learning workspace.",
  "Help the user understand topics, answer questions clearly, and support their study goals.",
  "Use Markdown for structure: short paragraphs, lists, headings and fenced code blocks when they help.",
  "If you are unsure about a fact, say so instead of inventing an answer.",
] as const;

const STYLE_INSTRUCTIONS: Record<UserSettings["ai"]["responseStyle"], string> = {
  concise: "Keep answers brief and to the point.",
  balanced: "Balance depth with readability: enough detail to learn from, without padding.",
  detailed: "Give thorough, well-structured explanations with helpful detail.",
};

export type SystemPromptContext = {
  responseStyle: UserSettings["ai"]["responseStyle"];
};

/**
 * Builds the system prompt for a chat turn. Versioned so behavior changes are
 * deliberate and traceable.
 */
export function buildSystemPrompt(context: SystemPromptContext): string {
  return [
    ...BASE_INSTRUCTIONS,
    STYLE_INSTRUCTIONS[context.responseStyle] ?? STYLE_INSTRUCTIONS.balanced,
  ].join("\n");
}

export const systemPromptVersion = PROMPT_VERSION;
