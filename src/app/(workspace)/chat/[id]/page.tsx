import type { Metadata } from "next";
import { ConversationView } from "@/components/chat/ConversationView";

export const metadata: Metadata = {
  title: "Conversation",
};

/**
 * A persisted conversation. Ownership is enforced by the API: opening an id that
 * belongs to another account resolves to not found rather than rendering it.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationView conversationId={id} />;
}