"use client";

import { useCallback, useState } from "react";
import { fileService } from "@/lib/api/services";
import { useToast } from "@/components/ui/Toast";
import type { ComposerAttachment } from "./ChatComposer";

/** Shared upload/status state for composer file attachments. */
export function useComposerAttachments() {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const { notify } = useToast();

  const uploadOne = useCallback(
    async (item: File) => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setAttachments((current) => [
        ...current,
        { id: localId, name: item.name, status: "uploading" as const },
      ]);
      try {
        const { file } = await fileService.upload(item);
        setAttachments((current) =>
          current.map((entry) =>
            entry.id === localId
              ? {
                  id: file.id,
                  name: file.filename,
                  status: file.status === "ready" ? ("ready" as const) : ("error" as const),
                }
              : entry
          )
        );
      } catch {
        setAttachments((current) =>
          current.map((entry) =>
            entry.id === localId ? { ...entry, status: "error" as const } : entry
          )
        );
        notify({ tone: "error", title: `Could not upload ${item.name}` });
      }
    },
    [notify]
  );

  const attach = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => void uploadOne(file));
    },
    [uploadOne]
  );

  const remove = useCallback((id: string) => {
    setAttachments((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => setAttachments([]), []);

  /** Only ids of files whose processing completed successfully. */
  const readyIds = attachments
    .filter((entry) => entry.status === "ready")
    .map((entry) => entry.id);

  const hasPending = attachments.some((entry) => entry.status === "uploading");

  return { attachments, attach, remove, clear, readyIds, hasPending };
}
