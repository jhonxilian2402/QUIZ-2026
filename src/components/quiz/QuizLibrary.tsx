"use client";

import { useCallback, useEffect, useState } from "react";
import { quizService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { SectionCard } from "./SectionCard";
import type { QuizResponse } from "@/lib/api/contracts";
import styles from "./QuizLibrary.module.css";

type QuizLibraryProps = {
  onOpen: (quiz: QuizResponse) => void;
  refreshKey: number;
};

/**
 * Real quiz library: the caller's stored quizzes with question totals and the
 * latest attempt result. Values come from the database, never hardcoded.
 */
export function QuizLibrary({ onOpen, refreshKey }: QuizLibraryProps) {
  const { notify } = useToast();
  const [items, setItems] = useState<QuizResponse[] | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await quizService.list({ limit: 20 });
      setItems(page.items);
    } catch (cause) {
      setItems([]);
      notify({
        tone: "error",
        title: "Could not load quizzes",
        description: cause instanceof ApiError ? cause.message : "Please try again.",
      });
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <SectionCard
      id="quiz-library"
      index={5}
      title="Your quizzes"
      description="Generated quizzes stored on your account. Open one to review, retake or delete it."
    >
      {items === null ? (
        <p className={styles.muted}>Loading quizzes…</p>
      ) : items.length === 0 ? (
        <p className={styles.muted}>
          No quizzes yet. Configure one above and generate it.
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((quiz) => (
            <li key={quiz.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onOpen(quiz)}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{quiz.title}</span>
                  <span className={styles.rowMeta}>
                    {quiz.subject}
                    {quiz.topic ? ` — ${quiz.topic}` : ""} · {quiz.difficulty} ·{" "}
                    {quiz.questionTotal ?? quiz.questionCount} questions
                  </span>
                </span>
                <span className={styles.rowScore}>
                  {quiz.latestAttempt && quiz.latestAttempt.score !== null
                    ? `${Math.round(quiz.latestAttempt.score)}%`
                    : quiz.latestAttempt
                      ? quiz.latestAttempt.status
                      : "New"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
