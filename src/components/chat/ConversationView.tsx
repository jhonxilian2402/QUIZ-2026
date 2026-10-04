"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatComposer } from "./ChatComposer";
import { MarkdownContent } from "./MarkdownContent";
import { useSidebarDrawer } from "@/components/layout/AppShell";
import { useSettings } from "@/components/settings/SettingsProvider";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ArrowLeftIcon,
  MenuIcon,
  MessageIcon,
  WarningIcon,
} from "@/components/ui/icons";
import { conversationService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import {
  chatService,
  type ChatSession,
} from "@/lib/chat/chatSessions";
import { useComposerAttachments } from "./useComposerAttachments";
import { COMPOSER_PLACEHOLDER } from "@/lib/content";
import type { MessageResponse } from "@/lib/api/contracts";
import styles from "./ConversationView.module.css";

/**
 * Conversation view.
 *
 * Loads a persisted conversation and runs real chat turns: the user message is
 * persisted first, the assistant reply streams from the provider into the
 * transcript, and the final state is persisted server-side — so a refresh
 * restores everything exactly as it was left.
 */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { drawerOpen, openDrawer } = useSidebarDrawer();
  const { settings } = useSettings();
  const { notify } = useToast();

  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [conversationModel, setConversationModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** Optimistic bubble shown until the server confirms persistence. */
  const [pending, setPending] = useState<{ id: string; content: string } | null>(null);
  /** A failed turn the user can retry without retyping. */
  const [failedTurn, setFailedTurn] = useState<{
    content: string;
    clientRequestId: string;
    message: string;
  } | null>(null);
  const [session, setSession] = useState<ChatSession | null>(() =>
    chatService.session(conversationId)
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const streaming = session?.status === "streaming";

  const loadMessages = useCallback(
    async (signal?: AbortSignal) => {
      const [conversation, page] = await Promise.all([
        conversationService.get(conversationId, signal),
        conversationService.messages(conversationId, { limit: 30 }, signal),
      ]);
      return { conversation, page };
    },
    [conversationId]
  );

  // Load the conversation and its newest page of messages.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    loadMessages(controller.signal)
      .then(({ conversation, page }) => {
        setTitle(conversation.title);
        setConversationModel(conversation.model);
        // The API returns newest-first for paging; display oldest-first.
        setMessages([...page.items].reverse());
        setCursor(page.nextCursor);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(
          cause instanceof ApiError ? cause.message : "Could not load this conversation."
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [loadMessages]);

  // Subscribe to the in-flight turn for this conversation (one may already be
  // running, started on the home screen before navigation).
  useEffect(() => {
    setSession(chatService.session(conversationId));
    return chatService.subscribe(conversationId, () => {
      setSession(chatService.session(conversationId));
    });
  }, [conversationId]);

  // When a turn ends, reconcile with the authoritative database state.
  useEffect(() => {
    if (!session || session.status === "streaming") return;

    const finalized = session;
    const controller = new AbortController();
    loadMessages(controller.signal)
      .then(({ conversation, page }) => {
        setTitle(conversation.title);
        setConversationModel(conversation.model);
        setMessages([...page.items].reverse());
        setCursor(page.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => {
        if (finalized.status === "error") {
          setFailedTurn({
            content: finalized.content,
            clientRequestId: finalized.clientRequestId,
            message: finalized.error?.message ?? "The response could not be generated.",
          });
          // A pre-persistence failure keeps the user's text in the composer.
          if (!finalized.userMessage) setDraft(finalized.content);
        } else if (finalized.status === "cancelled" && !finalized.assistantMessage) {
          setFailedTurn({
            content: finalized.content,
            clientRequestId: finalized.clientRequestId,
            message: "Generation stopped before any output.",
          });
        }
        setPending(null);
        chatService.clear(conversationId);
      });
  }, [session, conversationId, loadMessages]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await conversationService.messages(conversationId, {
        limit: 30,
        cursor,
      });
      setMessages((current) => [...[...page.items].reverse(), ...current]);
      setCursor(page.nextCursor);
    } catch {
      notify({ tone: "error", title: "Could not load earlier messages" });
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, cursor, loadingOlder, notify]);

  const {
    attachments,
    attach: handleAttach,
    remove: removeAttachment,
    clear: clearAttachments,
    readyIds: readyAttachmentIds,
    hasPending: attachmentsPending,
  } = useComposerAttachments();

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || streaming) return;
      if (attachmentsPending) {
        notify({ tone: "error", title: "Wait for file processing to finish" });
        return;
      }
      const clientRequestId = crypto.randomUUID();
      setPending({ id: `pending-${clientRequestId}`, content: trimmed });
      setFailedTurn(null);
      setDraft("");
      clearAttachments();
      nearBottomRef.current = true;
      chatService.send({
        conversationId,
        content: trimmed,
        clientRequestId,
        model: conversationModel,
        attachments: readyAttachmentIds.length > 0 ? readyAttachmentIds : undefined,
      });
    },
    [conversationId, conversationModel, streaming, attachmentsPending, readyAttachmentIds, notify, clearAttachments]
  );

  const retry = useCallback(() => {
    if (!failedTurn || streaming) return;
    const { content, clientRequestId } = failedTurn;
    setFailedTurn(null);
    setPending({ id: `pending-${clientRequestId}`, content });
    chatService.send({ conversationId, content, clientRequestId, model: conversationModel });
  }, [conversationId, conversationModel, failedTurn, streaming]);

  const stop = useCallback(() => {
    chatService.stop(conversationId);
  }, [conversationId]);

  /* ---------------- Intelligent scrolling ---------------- */

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    nearBottomRef.current = distance < 96;
    setShowJumpToLatest(distance >= 160);
  }, []);

  const jumpToLatest = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    nearBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  // Follow the stream while the user stays near the bottom.
  useEffect(() => {
    if (streaming && nearBottomRef.current) {
      const node = scrollRef.current;
      node?.scrollTo({ top: node.scrollHeight });
    }
  }, [session?.assistantDraft, streaming]);

  // Land at the latest message when the conversation opens.
  useEffect(() => {
    if (!loading) {
      const node = scrollRef.current;
      node?.scrollTo({ top: node.scrollHeight });
    }
  }, [loading]);

  const isEmpty = useMemo(
    () =>
      !loading &&
      messages.length === 0 &&
      !session?.userMessage &&
      !pending &&
      !session?.assistantDraft,
    [loading, messages.length, session, pending]
  );

  // The persisted user message for the active turn, unless it is already in
  // the loaded history (dedupe by id).
  const turnUserMessage =
    session?.userMessage && !messages.some((m) => m.id === session.userMessage?.id)
      ? session.userMessage
      : null;

  const modelId = conversationModel ?? settings.chat.defaultModelId;

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.topLeft}>
          <IconButton
            label="Open navigation"
            size="sm"
            className={styles.drawerButton}
            onClick={openDrawer}
            aria-expanded={drawerOpen}
          >
            <MenuIcon size={16} />
          </IconButton>
          <IconButton
            label="Back to chat"
            size="sm"
            onClick={() => router.push("/")}
          >
            <ArrowLeftIcon size={16} />
          </IconButton>
          <span className={styles.title} title={title}>
            {title || "Conversation"}
          </span>
          {streaming && session?.fallbackUsed ? (
            <StatusPill tone="muted">Fallback model</StatusPill>
          ) : null}
        </div>
      </div>

      <div ref={scrollRef} className={styles.scroll} onScroll={handleScroll}>
        <div className={styles.column}>
          {loading ? (
            <div className={styles.skeletons} aria-hidden>
              <Skeleton width="62%" height={14} radius="md" />
              <Skeleton width="48%" height={14} radius="md" />
              <Skeleton width="70%" height={14} radius="md" />
            </div>
          ) : null}

          {error ? (
            <EmptyState
              icon={<WarningIcon size={17} />}
              title="Unable to load this conversation"
              description={error}
              action={
                <Button variant="subtle" size="sm" onClick={() => router.refresh()}>
                  Try again
                </Button>
              }
            />
          ) : null}

          {isEmpty && !error ? (
            <EmptyState
              icon={<MessageIcon size={17} />}
              title="No messages yet"
              description="Send the first message below. It will be stored on your account."
            />
          ) : null}

          {cursor ? (
            <div className={styles.loadOlder}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadOlder()}
                loading={loadingOlder}
              >
                Load earlier messages
              </Button>
            </div>
          ) : null}

          <ul className={styles.messages}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {pending && !turnUserMessage ? (
              <li className={cnMessage("user")} data-role="user">
                <span className={styles.role}>user</span>
                <div className={styles.content}>{pending.content}</div>
              </li>
            ) : null}

            {turnUserMessage ? (
              <MessageBubble message={turnUserMessage} />
            ) : null}

            {streaming ? (
              <li className={cnMessage("assistant")} data-role="assistant">
                <span className={styles.role}>
                  {session?.model ?? "assistant"}
                </span>
                {session?.assistantDraft ? (
                  <MarkdownContent
                    content={session.assistantDraft}
                    className={styles.streamingContent}
                  />
                ) : (
                  <span className={styles.thinking} role="status">
                    Thinking…
                  </span>
                )}
              </li>
            ) : null}
          </ul>

          {failedTurn ? (
            <div className={styles.turnError} role="alert">
              <span className={styles.turnErrorText}>
                <WarningIcon size={14} />
                {failedTurn.message}
              </span>
              <Button variant="subtle" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {showJumpToLatest ? (
        <button type="button" className={styles.jumpToLatest} onClick={jumpToLatest}>
          Jump to latest
        </button>
      ) : null}

      <div className={styles.composerRegion}>
        <div className={styles.composerColumn}>
          {streaming ? (
            <div className={styles.stopRow}>
              <Button variant="subtle" size="sm" onClick={stop}>
                Stop generating
              </Button>
            </div>
          ) : null}
          <ChatComposer
            value={draft}
            onValueChange={setDraft}
            placeholder={COMPOSER_PLACEHOLDER}
            modelId={modelId}
            disabled={streaming}
            attachments={attachments}
            onAttach={handleAttach}
            onRemoveAttachment={removeAttachment}
            onSubmit={(value) => {
              if (streaming) return;
              send(value);
            }}
            enterSends={settings.chat.enterKeyBehavior === "send"}
            spellCheck={settings.chat.spellcheck}
          />
        </div>
      </div>
    </div>
  );
}

/** A persisted message; assistant turns render as safe Markdown. */
function MessageBubble({ message }: { message: MessageResponse }) {
  const status = message.metadata?.status;
  const partial = message.metadata?.partial === true;

  return (
    <li className={cnMessage(message.role)} data-role={message.role}>
      <span className={styles.role}>
        {message.role === "assistant" ? message.metadata?.model ?? "assistant" : message.role}
      </span>
      {message.role === "assistant" ? (
        <MarkdownContent content={message.content} className={styles.content} />
      ) : (
        <div className={styles.content}>{message.content}</div>
      )}
      {status === "failed" ? (
        <span className={styles.turnNote} role="note">
          <WarningIcon size={12} />
          {partial ? "Generation failed — partial answer." : "Generation failed."}
        </span>
      ) : status === "cancelled" ? (
        <span className={styles.turnNote} role="note">
          {partial ? "Stopped — partial answer." : "Generation stopped."}
        </span>
      ) : null}
      {message.role === "assistant" && message.metadata?.fileCitations?.length ? (
        <ul className={styles.fileCitations} aria-label="Sources">
          {message.metadata.fileCitations.map((citation) => (
            <li key={`${citation.fileId}:${citation.page ?? "none"}`}>
              📄 {citation.filename}
              {citation.page !== null ? ` — page ${citation.page}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {message.role === "user" && message.metadata?.attachments?.length ? (
        <span className={styles.turnNote}>
          📎 {message.metadata.attachments.length} file
          {message.metadata.attachments.length === 1 ? "" : "s"} attached
        </span>
      ) : null}
    </li>
  );
}

function cnMessage(role: MessageResponse["role"]): string {
  return [styles.message, styles[role] ?? ""].filter(Boolean).join(" ");
}
