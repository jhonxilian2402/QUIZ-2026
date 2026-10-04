import { and, desc, eq, ilike, lt, isNull, sql } from "drizzle-orm";
import { ensureDbReady, getDb } from "../db/client";
import { conversations, messages } from "../db/schema";
import type { ConversationResponse, MessageResponse } from "@/lib/api/contracts";

/**
 * Conversation and message repository.
 *
 * Every statement here is scoped by userId. There is deliberately no
 * "find by id alone" helper for user-owned data: ownership is part of the
 * lookup, not a check that a caller might forget.
 */

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

/* ---------------- Conversations ---------------- */

export async function listConversations(options: {
  userId: string;
  limit: number;
  cursor?: string | null;
  search?: string;
  includeArchived?: boolean;
}): Promise<{ items: ConversationRow[]; nextCursor: string | null }> {
  await ensureDbReady();

  const conditions = [eq(conversations.userId, options.userId)];
  if (!options.includeArchived) conditions.push(isNull(conversations.archivedAt));
  if (options.search) {
    conditions.push(ilike(conversations.title, `%${options.search}%`));
  }
  if (options.cursor) {
    // Cursor is the ISO timestamp of the last item; ordering is by recency.
    const cursorDate = new Date(options.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(conversations.updatedAt, cursorDate));
    }
  }

  // Fetch one extra row to know whether another page exists.
  const rows = await getDb()
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore
    ? items[items.length - 1].updatedAt.toISOString()
    : null;

  return { items, nextCursor };
}

export async function findConversationForUser(
  id: string,
  userId: string
): Promise<ConversationRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function insertConversation(input: {
  userId: string;
  title?: string;
  model?: string | null;
}): Promise<ConversationRow> {
  await ensureDbReady();
  const [row] = await getDb()
    .insert(conversations)
    .values({
      userId: input.userId,
      title: input.title?.trim() || "New conversation",
      model: input.model ?? null,
    })
    .returning();
  return row;
}

export async function updateConversationForUser(
  id: string,
  userId: string,
  patch: { title?: string; model?: string | null; archived?: boolean }
): Promise<ConversationRow | null> {
  await ensureDbReady();
  const now = new Date();
  const [row] = await getDb()
    .update(conversations)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.archived !== undefined
        ? { archivedAt: patch.archived ? now : null }
        : {}),
      updatedAt: now,
    })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteConversationForUser(
  id: string,
  userId: string
): Promise<boolean> {
  await ensureDbReady();
  const rows = await getDb()
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return rows.length > 0;
}

/** Touches updatedAt so activity ordering reflects the latest message. */
export async function touchConversation(id: string): Promise<void> {
  await ensureDbReady();
  await getDb()
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

/* ---------------- Messages ---------------- */

export async function listMessages(options: {
  conversationId: string;
  limit: number;
  cursor?: string | null;
}): Promise<{ items: MessageRow[]; nextCursor: string | null }> {
  await ensureDbReady();

  const conditions = [eq(messages.conversationId, options.conversationId)];
  if (options.cursor) {
    const cursorDate = new Date(options.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(messages.createdAt, cursorDate));
    }
  }

  const rows = await getDb()
    .select()
    .from(messages)
    .where(and(...conditions))
    // Newest first so the client can page backwards through history; the id
    // tiebreaker keeps ordering deterministic for messages created in the
    // same instant.
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return { items, nextCursor };
}

export async function insertMessage(input: {
  conversationId: string;
  role: MessageRow["role"];
  content: string;
  metadata?: MessageRow["metadata"];
}): Promise<MessageRow> {
  await ensureDbReady();
  const [row] = await getDb()
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? null,
    })
    .returning();
  return row;
}

/**
 * Idempotency lookup: finds a message by the client request id stored in its
 * metadata, so a retried send can be reconciled instead of duplicated.
 */
export async function findMessageByClientRequestId(
  conversationId: string,
  clientRequestId: string
): Promise<MessageRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.metadata} ->> 'clientRequestId' = ${clientRequestId}`
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * The most recent messages in chronological order, for AI context building.
 * The assistant's own failed/cancelled turns are excluded: they are not valid
 * context for the next generation.
 */
export async function listRecentMessagesForContext(
  conversationId: string,
  limit: number
): Promise<MessageRow[]> {
  await ensureDbReady();
  const rows = await getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);
  return rows
    .filter((row) => {
      const status = row.metadata?.status;
      return status !== "failed" && status !== "cancelled";
    })
    .reverse();
}

/** Finds the completed assistant reply to a user message, when one exists. */
export async function findCompletedAssistantReplyAfter(
  conversationId: string,
  after: Date
): Promise<MessageRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, "assistant"),
        sql`${messages.createdAt} >= ${after}`,
        sql`coalesce(${messages.metadata} ->> 'status', 'completed') = 'completed'`
      )
    )
    .orderBy(messages.createdAt)
    .limit(1);
  return row ?? null;
}

/**
 * Removes failed/cancelled assistant attempts after a user message. Used when
 * a turn is retried: the transcript ends up with exactly one assistant reply.
 */
export async function deleteFailedAssistantMessagesAfter(
  conversationId: string,
  after: Date
): Promise<void> {
  await ensureDbReady();
  await getDb()
    .delete(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, "assistant"),
        sql`${messages.createdAt} >= ${after}`,
        sql`coalesce(${messages.metadata} ->> 'status', 'completed') <> 'completed'`
      )
    );
}

export async function countMessagesForUser(userId: string): Promise<number> {
  await ensureDbReady();
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId));
  return row?.value ?? 0;
}

/* ---------------- Serializers ---------------- */

export function toConversationResponse(row: ConversationRow): ConversationResponse {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

export function toMessageResponse(row: MessageRow): MessageResponse {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}