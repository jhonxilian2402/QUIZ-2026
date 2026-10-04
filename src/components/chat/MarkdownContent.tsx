"use client";

import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import styles from "./MarkdownContent.module.css";

/**
 * Renders an assistant message as sanitized Markdown. The HTML is produced
 * through the safe pipeline in lib/markdown; nothing else reaches the DOM.
 */
export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className={cn(styles.prose, className)}
      // Safe by construction: renderMarkdown sanitizes before this point.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
