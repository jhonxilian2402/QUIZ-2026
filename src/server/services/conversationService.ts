import {
  deleteConversationForUser,
  findConversationForUser,
  insertConversation,
  insertMessage,
  listConversations,
  listMessages,
  toConversationResponse,
  toMessageResponse,
  touchConversation,
  updateConversationForUser,
} from "../repositories/conversationRepository";
import { NotFoundError, ValidationError } from "../errors";
import { logger } from "../logger";
import type {
  ConversationResponse,
  MessageResponse,
  Page,
} from "@/lib/api/contracts";
import type {
  ConversationCreateInput,
  ConversationUpdateInput,
  MessageCreateInput,
} from "@/lib/api/schemas";

/**
 * Conversation service.
 *
 * Ownership is enforced by scoping every repository call to the authenticated
 * user, so a request for another user's conversation resolves to "not found"
 * rather than leaking that the id exists.
 *
 * AI generation is intentionally absent: a user message is persisted and the
 * assistant turn is left to a later phase, which will call AIService behind
 * this same boundary.
 */

export async function list(
  userId: string,
  options: { limit: number; cursor?: string; search?: string }
): Promise<Page<ConversationResponse>> {
  const { items, nextCursor } = await listConversations({
    userId,
    limit: options.limit,
    cursor: options.cursor ?? null,
    search: options.search,
  });
  return { items: items.map(toConversationResponse), nextCursor };
}

export async function create(
  userId: string,
  input: ConversationCreateInput
): Promise<ConversationResponse> {
  const row = await insertConversation({
    userId,
    title: input.title,
    model: input.model ?? null,
  });
  logger.info("Conversation created", { userId, route: "conversations" });
  return toConversationResponse(row);
}

export async function getById(
  userId: string,
  conversationId: string
): Promise<ConversationResponse> {
  const row = await findConversationForUser(conversationId, userId);
  if (!row) throw new NotFoundError("Conversation not found.");
  return toConversationResponse(row);
}

export async function update(
  userId: string,
  conversationId: string,
  input: ConversationUpdateInput
): Promise<ConversationResponse> {
  const row = await updateConversationForUser(conversationId, userId, input);
  if (!row) throw new NotFoundError("Conversation not found.");
  return toConversationResponse(row);
}

export async function remove(
  userId: string,
  conversationId: string
): Promise<void> {
  const removed = await deleteConversationForUser(conversationId, userId);
  if (!removed) throw new NotFoundError("Conversation not found.");
  logger.info("Conversation deleted", { userId, route: "conversations" });
}

export async function listMessagesForConversation(
  userId: string,
  conversationId: string,
  options: { limit: number; cursor?: string }
): Promise<Page<MessageResponse>> {
  // Verify ownership first so messages of another user's conversation are
  // unreachable even though they share no direct user column.
  const conversation = await findConversationForUser(conversationId, userId);
  if (!conversation) throw new NotFoundError("Conversation not found.");

  const { items, nextCursor } = await listMessages({
    conversationId,
    limit: options.limit,
    cursor: options.cursor ?? null,
  });

  // Returned newest-first for paging; the client reverses for display.
  return { items: items.map(toMessageResponse), nextCursor };
}

export async function addMessage(
  userId: string,
  conversationId: string,
  input: MessageCreateInput
): Promise<MessageResponse> {
  const conversation = await findConversationForUser(conversationId, userId);
  if (!conversation) throw new NotFoundError("Conversation not found.");

  if (conversation.archivedAt) {
    throw new ValidationError("This conversation is archived.");
  }

  const row = await insertMessage({
    conversationId,
    role: input.role,
    content: input.content,
    // No provider exists yet, so no model, token or citation metadata is
    // written. Fabricating it would misrepresent what happened.
    metadata: null,
  });

  await touchConversation(conversationId);

  return toMessageResponse(row);
}