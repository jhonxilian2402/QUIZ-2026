"use client";

import { streamChatTurn } from "@/lib/api/chatStream";
import type {
  ChatStreamUsage,
  ConversationResponse,
  MessageResponse,
} from "@/lib/api/contracts";

/**
 * Chat session manager.
 *
 * One in-flight turn per conversation, kept in a module-level store so a turn
 * started on the home screen keeps streaming after the router moves to the
 * conversation view — the view simply subscribes to the same session. Also
 * the source of "conversation activity" signals the sidebar listens to.
 */

export type ChatSessionStatus = "streaming" | "complete" | "error" | "cancelled";

export type ChatSession = {
  conversationId: string;
  status: ChatSessionStatus;
  /** The persisted user message for this turn, once the server confirms it. */
  userMessage: MessageResponse | null;
  /** Accumulated assistant text while streaming. */
  assistantDraft: string;
  /** The persisted assistant message after the turn ends (complete or partial). */
  assistantMessage: MessageResponse | null;
  error: { code: string; message: string } | null;
  model: string | null;
  requestedModel: string | null;
  fallbackUsed: boolean;
  usage: ChatStreamUsage | null;
  /** Present after a completed turn; carries the auto-derived title. */
  conversation: ConversationResponse | null;
  /** The idempotency key of this turn; needed to retry without duplicating. */
  clientRequestId: string;
  /** The original text, needed to retry without duplicating. */
  content: string;
};

type Listener = () => void;

const sessions = new Map<string, ChatSession>();
const controllers = new Map<string, AbortController>();
const sessionListeners = new Map<string, Set<Listener>>();
const activityListeners = new Set<Listener>();

function notify(conversationId: string): void {
  for (const listener of sessionListeners.get(conversationId) ?? []) listener();
}

function notifyActivity(): void {
  for (const listener of activityListeners) listener();
}

function update(conversationId: string, patch: Partial<ChatSession>): void {
  const current = sessions.get(conversationId);
  if (!current) return;
  sessions.set(conversationId, { ...current, ...patch });
  notify(conversationId);
}

export function getChatSession(conversationId: string): ChatSession | null {
  return sessions.get(conversationId) ?? null;
}

/** Drops a finished session once the view has integrated it. */
export function clearChatSession(conversationId: string): void {
  const session = sessions.get(conversationId);
  if (session?.status === "streaming") return;
  sessions.delete(conversationId);
  notify(conversationId);
}

export function subscribeChatSession(conversationId: string, listener: Listener): () => void {
  let set = sessionListeners.get(conversationId);
  if (!set) {
    set = new Set();
    sessionListeners.set(conversationId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) sessionListeners.delete(conversationId);
  };
}

/** Fires when any turn ends or a conversation is created (sidebar refresh). */
export function subscribeChatActivity(listener: Listener): () => void {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

/**
 * Starts a chat turn. The returned promise resolves when the stream ends;
 * callers usually do not await it — they subscribe to the session instead.
 */
export function startChatTurn(options: {
  conversationId: string;
  content: string;
  clientRequestId: string;
  model?: string | null;
  attachments?: string[];
}): ChatSession {
  const controller = new AbortController();
  controllers.set(options.conversationId, controller);

  const session: ChatSession = {
    conversationId: options.conversationId,
    status: "streaming",
    userMessage: null,
    assistantDraft: "",
    assistantMessage: null,
    error: null,
    model: null,
    requestedModel: null,
    fallbackUsed: false,
    usage: null,
    conversation: null,
    clientRequestId: options.clientRequestId,
    content: options.content,
  };
  sessions.set(options.conversationId, session);
  notify(options.conversationId);

  void streamChatTurn(
    options.conversationId,
    {
      content: options.content,
      clientRequestId: options.clientRequestId,
      model: options.model,
      attachments: options.attachments,
    },
    {
      onEvent: (event) => {
        if (event.type === "start") {
          update(options.conversationId, {
            userMessage: event.userMessage,
            model: event.model,
            requestedModel: event.requestedModel,
            fallbackUsed: event.fallbackUsed,
          });
        } else if (event.type === "delta") {
          const current = sessions.get(options.conversationId);
          if (!current) return;
          update(options.conversationId, {
            assistantDraft: current.assistantDraft + event.content,
          });
        } else if (event.type === "usage") {
          update(options.conversationId, { usage: event.usage });
        } else if (event.type === "complete") {
          update(options.conversationId, {
            status: "complete",
            assistantMessage: event.assistantMessage,
            conversation: event.conversation,
          });
          controllers.delete(options.conversationId);
          notifyActivity();
        } else if (event.type === "error") {
          update(options.conversationId, {
            status: event.code === "AI_UNKNOWN_ERROR" && event.message === "Generation stopped."
              ? "cancelled"
              : "error",
            error: { code: event.code, message: event.message },
            userMessage: event.userMessage ?? sessions.get(options.conversationId)?.userMessage ?? null,
            assistantMessage: event.assistantMessage,
          });
          controllers.delete(options.conversationId);
          notifyActivity();
        }
      },
    },
    controller.signal
  ).catch((error: unknown) => {
    controllers.delete(options.conversationId);
    if (error instanceof DOMException && error.name === "AbortError") {
      // Explicit Stop / navigation: the server marks the partial as cancelled.
      update(options.conversationId, { status: "cancelled" });
      notifyActivity();
      return;
    }
    update(options.conversationId, {
      status: "error",
      error: {
        code: "code" in (error as { code?: string }) ? String((error as { code?: string }).code) : "NETWORK_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Could not reach the server. Check your connection.",
      },
    });
    notifyActivity();
  });

  return session;
}

/** Aborts the in-flight turn (Stop button). The provider request is aborted. */
export function stopChatTurn(conversationId: string): void {
  controllers.get(conversationId)?.abort();
}

/** True while a turn for this conversation is streaming. */
export function isChatTurnActive(conversationId: string): boolean {
  return sessions.get(conversationId)?.status === "streaming";
}

/**
 * The chat service facade used by components. Conversation CRUD stays on
 * conversationService; this owns the live turn lifecycle.
 */
export const chatService = {
  send: startChatTurn,
  stop: stopChatTurn,
  session: getChatSession,
  subscribe: subscribeChatSession,
  subscribeActivity: subscribeChatActivity,
  clear: clearChatSession,
  isActive: isChatTurnActive,
};
