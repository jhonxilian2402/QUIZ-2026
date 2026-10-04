"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE,
  SUPPORTED_FORMATS_LABEL,
  createQuizFile,
  formatFileSize,
} from "@/lib/quiz";
import { cn } from "@/lib/utils";
import { fileService } from "@/lib/api/services";
import { IconButton } from "@/components/ui/IconButton";
import {
  FileIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/ui/icons";
import type { QuizFile } from "@/types";
import styles from "./FileUpload.module.css";

type FileUploadProps = {
  files: QuizFile[];
  onChange: (files: QuizFile[]) => void;
  errors?: string[];
  onError?: (message: string) => void;
};

/**
 * Drag-and-drop upload field. Selected files are uploaded for real
 * (multipart POST /api/files) and the server's processing status — uploading
 * → processing → ready/failed — is what the list shows. Status copy never
 * claims a file was processed when it was not.
 */
export function FileUpload({ files, onChange, errors = [], onError }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  /** Latest list snapshot so async upload completions patch the right entry. */
  const filesRef = useRef(files);
  filesRef.current = files;

  const patchFile = (localId: string, patch: Partial<QuizFile>) => {
    onChange(
      filesRef.current.map((entry) =>
        entry.id === localId ? { ...entry, ...patch } : entry
      )
    );
  };

  const ingest = (list: FileList | null) => {
    if (!list || list.length === 0) return;

    const accepted: QuizFile[] = [];
    const messages: string[] = [];

    Array.from(list).forEach((item, index) => {
      if (item.size > MAX_FILE_SIZE) {
        messages.push(`${item.name} exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit.`);
        return;
      }
      const { file, error } = createQuizFile(item.name, item.size, index);
      if (error) {
        messages.push(error);
        return;
      }
      if (file) accepted.push(file);
    });

    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
      accepted.forEach((entry) => {
        const item = Array.from(list).find(
          (candidate) => candidate.name === entry.name && candidate.size === entry.size
        );
        if (!item) return;
        void uploadOne(entry.id, item);
      });
    }
    if (messages.length > 0) onError?.(messages.join(" "));
  };

  const uploadOne = async (localId: string, item: File) => {
    patchFile(localId, { status: "processing" });
    try {
      const { file } = await fileService.upload(item);
      patchFile(localId, {
        id: file.id,
        status: file.status === "ready" ? "ready" : file.status === "failed" ? "failed" : "processing",
        message: file.error ?? undefined,
      });
    } catch (cause) {
      patchFile(localId, {
        status: "failed",
        message: cause instanceof Error ? cause.message : "Upload failed.",
      });
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    ingest(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    ingest(event.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    onChange(files.filter((file) => file.id !== id));
  };

  return (
    <div className={styles.root}>
      <div
        className={cn(styles.dropzone, dragging && styles.dragging)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload material"
      >
        <span className={styles.dropIcon}>
          <UploadIcon size={18} />
        </span>
        <span className={styles.dropTitle}>
          Drop files here or <span className={styles.browse}>browse</span>
        </span>
        <span className={styles.dropHint}>
          {SUPPORTED_FORMATS_LABEL} · up to {formatFileSize(MAX_FILE_SIZE)} per file
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className={styles.input}
          onChange={handleInput}
          tabIndex={-1}
        />
      </div>

      {errors.length > 0 ? (
        <ul className={styles.errors}>
          {errors.map((message) => (
            <li key={message} className={styles.error}>
              <WarningIcon size={14} />
              <span>{message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul className={styles.list}>
          {files.map((file) => (
            <li key={file.id} className={styles.file}>
              <span className={styles.fileIcon}>
                <FileIcon size={16} />
              </span>
              <span className={styles.fileMeta}>
                <span className={styles.fileName} title={file.name}>
                  {file.name}
                </span>
                <span className={styles.fileSub}>
                  {file.extension.toUpperCase()} · {formatFileSize(file.size)} ·{" "}
                  <span className={styles.pending}>
                    {file.status === "ready"
                      ? "Ready to use"
                      : file.status === "processing" || file.status === "queued"
                        ? "Processing…"
                        : file.message ?? "Processing failed"}
                  </span>
                </span>
              </span>
              <IconButton
                label={`Remove ${file.name}`}
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  removeFile(file.id);
                }}
              >
                <TrashIcon size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}