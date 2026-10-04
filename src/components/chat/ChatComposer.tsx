"use client";

import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ComposerSurface, type ComposerSurfaceHandle } from "@/components/ui/Textarea";
import { ComposerActions } from "./ComposerActions";
import { TrashIcon } from "@/components/ui/icons";
import styles from "./ChatComposer.module.css";

export type ComposerAttachment = { id: string; name: string; status: "uploading" | "ready" | "error" };

type ChatComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  modelId?: string;
  onSubmit?: (value: string) => void;
  enterSends?: boolean;
  spellCheck?: boolean;
  attachments?: ComposerAttachment[];
  onAttach?: (files: FileList) => void;
  onRemoveAttachment?: (id: string) => void;
};

/**
 * Primary interaction surface. The submit path is deliberately unwired: a
 * send is only registered when a handler is supplied by a later phase.
 */
export function ChatComposer({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  onSubmit,
  enterSends = true,
  spellCheck = false,
  attachments = [],
  onAttach,
  onRemoveAttachment,
}: ChatComposerProps) {
  const surfaceRef = useRef<ComposerSurfaceHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (!enterSends) return;
      event.preventDefault();
      if (value.trim().length > 0) onSubmit?.(value.trim());
    },
    [enterSends, onSubmit, value]
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAttachChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        onAttach?.(event.target.files);
      }
      event.target.value = "";
    },
    [onAttach]
  );

  return (
    <ComposerSurface
      ref={surfaceRef}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      ariaLabel={placeholder}
      spellCheck={spellCheck}
      className={styles.composer}
      bodyClassName={styles.body}
      textareaClassName={styles.textarea}
      aboveBody={
        attachments.length > 0 ? (
          <ul className={styles.attachments} aria-label="Attached files">
            {attachments.map((attachment) => (
              <li key={attachment.id} className={styles.attachmentChip}>
                <span title={attachment.name}>{attachment.name}</span>
                <span className={styles.attachmentStatus}>
                  {attachment.status === "ready"
                    ? "ready"
                    : attachment.status === "uploading"
                      ? "processing…"
                      : "failed"}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => onRemoveAttachment?.(attachment.id)}
                >
                  <TrashIcon size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : undefined
      }
      footer={
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.docx,.pptx,.png,.jpg,.jpeg,.webp"
            className={styles.fileInput}
            onChange={handleAttachChange}
            tabIndex={-1}
            aria-hidden
          />
          <ComposerActions
            disabled={disabled}
            onAction={(id) => {
              if (id === "attach") handleAttachClick();
            }}
            onVoice={() => setVoiceActive((active) => !active)}
            onAudio={() => setAudioActive((active) => !active)}
            voiceActive={voiceActive}
            audioActive={audioActive}
          />
        </>
      }
    />
  );
}