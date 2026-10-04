import type { SuggestionCardData } from "@/types";

/**
 * Starters shown under the composer. Placeholder copy, product-relevant,
 * designed to be swapped for a dynamic list later.
 */
export const SUGGESTION_CARDS: SuggestionCardData[] = [
  {
    id: "starter-basics",
    title: "Start with the basics",
    description: "Turn any topic into a short set of questions you can actually finish.",
    prompt: "Turn a topic I choose into a short set of questions.",
  },
  {
    id: "starter-review",
    title: "Review what I missed",
    description: "Focus a session on the questions you answered incorrectly.",
    prompt: "Build a session around the questions I answered incorrectly.",
  },
  {
    id: "starter-progress",
    title: "Plan my practice",
    description: "Build a steady practice rhythm around the subjects you want.",
    prompt: "Suggest a practice plan for the subjects I want to improve.",
  },
];