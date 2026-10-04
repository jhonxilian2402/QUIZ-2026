import type { ConversationGroup } from "@/types";

/**
 * Conversation history buckets.
 *
 * The buckets are real structure; the items are intentionally left empty
 * until the conversation service is connected in a later phase. Nothing on
 * screen is presented as real user data.
 */
export const CONVERSATION_GROUPS: ConversationGroup[] = [
  { label: "Today", items: [] },
  { label: "Yesterday", items: [] },
  { label: "Previous", items: [] },
];

export const HISTORY_EMPTY_LABEL = "No conversations yet";

export const HISTORY_EMPTY_HINT =
  "Your chats from this device will appear here once the conversation service is connected.";