"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { HISTORY_HEADING } from "@/lib/content";
import { useQuery } from "@/lib/api/useQuery";
import { conversationService } from "@/lib/api/services";
import { chatService } from "@/lib/chat/chatSessions";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./ConversationHistory.module.css";

type Bucket = "Today" | "Yesterday" | "Previous";

/**
 * Conversation history.
 *
 * Renders the signed-in user's real conversations, grouped by recency. The API
 * returns them newest-first and scoped to the caller, so nothing is invented and
 * no other user's data can appear. Loading, empty and error states are all
 * represented honestly.
 */
function bucketFor(date: Date, now: Date): Bucket {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  return "Previous";
}

export function ConversationHistory({ expanded = true }: { expanded?: boolean }) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();

  const { data, loading, error, refetch } = useQuery(
    (signal) => conversationService.list({ limit: 30 }, signal),
    { key: "conversations" }
  );

  // New conversations and completed turns move entries around in real time.
  useEffect(() => chatService.subscribeActivity(() => refetch()), [refetch]);

  const groups = useMemo(() => {
    const now = new Date();
    const buckets: Record<Bucket, { id: string; title: string }[]> = {
      Today: [],
      Yesterday: [],
      Previous: [],
    };

    for (const conversation of data?.items ?? []) {
      const bucket = bucketFor(new Date(conversation.updatedAt), now);
      buckets[bucket].push({ id: conversation.id, title: conversation.title });
    }

    return (Object.keys(buckets) as Bucket[]).map((label) => ({
      label,
      items: buckets[label],
    }));
  }, [data]);

  return (
    <div className={styles.root}>
      <h2 className="sr-only">{HISTORY_HEADING}</h2>

      {loading && !data ? (
        <div className={styles.skeletons} aria-hidden>
          <Skeleton width={54} height={11} />
          <Skeleton width="82%" height={16} radius="md" />
          <Skeleton width="68%" height={16} radius="md" />
        </div>
      ) : null}

      {error && !data ? (
        <p className={styles.placeholder} role="status">
          Conversations could not be loaded.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.label} className={styles.group}>
          <h3 className={styles.groupLabel}>{group.label}</h3>

          {expanded && group.items.length === 0 && group.label === "Today" && data ? (
            <p className={styles.placeholder}>
              No conversations yet. Start one from the composer.
            </p>
          ) : null}

          {expanded
            ? group.items.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    styles.item,
                    params?.id === conversation.id && styles.itemActive
                  )}
                  onClick={() => router.push(`/chat/${conversation.id}`)}
                  title={conversation.title}
                >
                  {conversation.title}
                </button>
              ))
            : null}
        </section>
      ))}
    </div>
  );
}