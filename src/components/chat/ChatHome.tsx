"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SUGGESTION_CARDS } from "@/lib/suggestions";
import { COMPOSER_PLACEHOLDER, GREETING } from "@/lib/content";
import { useSettings } from "@/components/settings/SettingsProvider";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { MoreHorizontalIcon, MenuIcon } from "@/components/ui/icons";
import { ChatComposer } from "./ChatComposer";
import { useComposerAttachments } from "./useComposerAttachments";
import { ModelSelector } from "./ModelSelector";
import { SuggestionCards } from "./SuggestionCards";
import { WelcomeGreeting } from "./WelcomeGreeting";
import { WelcomeOrb } from "./WelcomeOrb";
import { useSidebarDrawer } from "@/components/layout/AppShell";
import { conversationService } from "@/lib/api/services";
import { chatService } from "@/lib/chat/chatSessions";
import { useModelCatalog } from "@/lib/api/useModelCatalog";
import { deriveTitle } from "@/lib/titles";
import { ApiError } from "@/lib/api/client";
import type { SelectableModel } from "@/types";
import styles from "./ChatHome.module.css";

/**
 * Home workspace composition: model selector, welcome cluster, composer and
 * suggestion starters.
 *
 * Sending creates a real conversation, starts the chat turn and navigates
 * immediately: the reply keeps streaming into the conversation view through
 * the shared chat session, so nothing is lost or simulated in between.
 */
export function ChatHome() {
  const router = useRouter();
  const { drawerOpen, openDrawer } = useSidebarDrawer();
  const { settings } = useSettings();
  const { notify } = useToast();
  const catalog = useModelCatalog({ freeOnly: true });
  // "" means automatic model resolution on the server; "assistant" is the
  // legacy stored sentinel for the same behavior.
  const [modelId, setModelId] = useState(
    settings.chat.defaultModelId === "assistant" ? "" : settings.chat.defaultModelId
  );
  const [draft, setDraft] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const {
    attachments,
    attach: handleAttach,
    remove: removeAttachment,
    clear: clearAttachments,
    readyIds: readyAttachmentIds,
    hasPending: attachmentsPending,
  } = useComposerAttachments();

  const models = useMemo<SelectableModel[]>(
    () => [
      {
        id: "",
        name: "Automatic",
        description: "Resolved from the live catalog",
      },
      ...catalog.models.map((model) => ({
        id: model.id,
        name: model.name,
        description: model.contextLabel,
      })),
    ],
    [catalog.models]
  );

  const handleSuggestion = (suggestion: (typeof SUGGESTION_CARDS)[number]) => {
    setDraft(suggestion.prompt);
    setActiveSuggestion(suggestion.id);
  };

  const handleSubmit = useCallback(
    async (value: string) => {
      const content = value.trim();
      if (sending || !content) return;
      if (attachmentsPending) {
        notify({ tone: "error", title: "Wait for file processing to finish" });
        return;
      }
      setSending(true);
      try {
        // A new conversation is titled from the first message so the sidebar
        // entry is meaningful without a separate naming step.
        const conversation = await conversationService.create({
          title: deriveTitle(content),
          model: modelId || null,
        });
        // Start the turn before navigating: the stream lives in the shared
        // chat session, and the conversation view picks it up on arrival.
        chatService.send({
          conversationId: conversation.id,
          content,
          clientRequestId: crypto.randomUUID(),
          model: modelId || null,
          attachments: readyAttachmentIds.length > 0 ? readyAttachmentIds : undefined,
        });
        setDraft("");
        setActiveSuggestion(null);
        clearAttachments();
        router.push(`/chat/${conversation.id}`);
      } catch (cause) {
        notify({
          tone: "error",
          title: "Could not start the conversation",
          description:
            cause instanceof ApiError ? cause.message : "The message was not stored.",
        });
      } finally {
        setSending(false);
      }
    },
    [modelId, notify, router, sending, attachmentsPending, readyAttachmentIds, clearAttachments]
  );

  return (
    <div className={styles.orchestrator}>
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
          <ModelSelector models={models} value={modelId} onChange={setModelId} />
        </div>
        <div className={styles.topRight}>
          <IconButton label="More options" size="sm" variant="outline">
            <MoreHorizontalIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div className={styles.thread}>
        <div className={styles.stage}>
          <div className={styles.center}>
            <div className={styles.column}>
              <div className={styles.welcome}>
                <WelcomeOrb />
                <WelcomeGreeting text={GREETING} />
              </div>

              <div className={styles.composerRegion}>
                <ChatComposer
                  value={draft}
                  onValueChange={setDraft}
                  placeholder={COMPOSER_PLACEHOLDER}
                  modelId={modelId}
                  disabled={sending}
                  attachments={attachments}
                  onAttach={handleAttach}
                  onRemoveAttachment={removeAttachment}
                  onSubmit={handleSubmit}
                  enterSends={settings.chat.enterKeyBehavior === "send"}
                  spellCheck={settings.chat.spellcheck}
                />
                <SuggestionCards
                  cards={SUGGESTION_CARDS}
                  activeId={activeSuggestion}
                  onSelect={handleSuggestion}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}