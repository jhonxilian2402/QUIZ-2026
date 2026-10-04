"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { WarningIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import styles from "./AvatarEditor.module.css";

type AvatarEditorProps = {
  /** Initials used when no image is selected. */
  initials: string;
  fileName: string | null;
  onSelect: (fileName: string | null, previewUrl: string | null) => void;
  onRemove: () => void;
};

const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Avatar editor. Selected images are read locally for preview only: nothing is
 * uploaded, and the copy says so explicitly. Invalid files surface a real error
 * state instead of silently failing.
 *
 * The preview bitmap lives in local state so it can be replaced by a real
 * upload response later without changing the component contract.
 */
export function AvatarEditor({
  initials,
  fileName,
  onSelect,
  onRemove,
}: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!AVATAR_TYPES.includes(file.type)) {
      setError("Use a PNG, JPEG, WEBP or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Images must be 4 MB or smaller.");
      return;
    }

    setProcessing(true);
    const url = URL.createObjectURL(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
    setProcessing(false);
    // Registered locally only — no upload happens in this phase.
    onSelect(file.name, url);
  };

  return (
    <div className={styles.root}>
      <div className={styles.preview}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected avatar preview" />
        ) : (
          <span className={styles.initials}>{initials}</span>
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.meta}>
          <span className={styles.metaTitle}>
            {fileName ?? "No image selected"}
          </span>
          <StatusPill tone="muted">
            {preview ? "Preview only · not uploaded" : "Initials in use"}
          </StatusPill>
        </div>

        <div className={styles.actions}>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
          >
            {fileName ? "Replace image" : "Choose image"}
          </Button>
          {fileName ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setError(null);
                onRemove();
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className={cn(styles.message, styles.error)}>
            <WarningIcon size={14} />
            {error}
          </p>
        ) : (
          <p className={styles.message}>
            PNG, JPEG, WEBP or GIF · up to 4 MB. Stored on this device until
            uploads are connected.
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        className={styles.input}
        onChange={handleFile}
        tabIndex={-1}
      />
    </div>
  );
}