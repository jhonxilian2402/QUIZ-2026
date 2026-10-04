"use client";

import { useCallback, useEffect, useState } from "react";
import { quizService } from "@/lib/api/services";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "./SectionCard";
import type { QuizAttemptResponse, QuizResponse } from "@/lib/api/contracts";
import styles from "./QuizOverview.module.css";

type QuizOverviewProps = {
  quiz: QuizResponse;
  onStartAttempt: (attempt: QuizAttemptResponse) => void;
  onOpenResults: (attemptId: string) => void;
  onBack: () => void;
  onDeleted: () => void;
};

/**
 * Real quiz overview: metadata, attempt history from the server and the
 * entry point for a new attempt. Nothing here is fabricated; an empty
 * history renders as an empty state.
 */
export function QuizOverview({
  quiz,
  onStartAttempt,
  onOpenResults,
  onBack,
  onDeleted,
}: QuizOverviewProps) {
  const { notify } = useToast();
  const [attempts, setAttempts] = useState<QuizAttemptResponse[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    quizService
      .listAttempts(quiz.id)
      .then((page) => {
        if (!cancelled) setAttempts(page.items);
      })
      .catch(() => {
        if (!cancelled) setAttempts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [quiz.id]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      const attempt = await quizService.startAttempt(quiz.id);
      onStartAttempt(attempt);
    } catch (cause) {
      notify({
        tone: "error",
        title: "Could not start the attempt",
        description: cause instanceof ApiError ? cause.message : "Please try again.",
      });
    } finally {
      setStarting(false);
    }
  }, [notify, onStartAttempt, quiz.id]);

  const handleDelete = useCallback(async () => {
    setRemoving(true);
    try {
      await quizService.remove(quiz.id);
      notify({ tone: "success", title: "Quiz deleted" });
      onDeleted();
    } catch (cause) {
      notify({
        tone: "error",
        title: "Could not delete the quiz",
        description: cause instanceof ApiError ? cause.message : "Please try again.",
      });
    } finally {
      setRemoving(false);
    }
  }, [notify, onDeleted, quiz.id]);

  return (
    <SectionCard
      id="quiz-overview"
      title={quiz.title}
      description={`${quiz.subject}${quiz.topic ? ` — ${quiz.topic}` : ""}`}
      action={
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      }
    >
      <dl className={styles.meta}>
        <div className={styles.metaItem}>
          <dt>Questions</dt>
          <dd>{quiz.questionCount}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Difficulty</dt>
          <dd>{quiz.difficulty}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Type</dt>
          <dd>{quiz.questionType}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Source</dt>
          <dd>{quiz.sourceMode}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Timing</dt>
          <dd>{quiz.timeLimit ? `${quiz.timeLimit} min` : "Untimed"}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Button variant="primary" size="md" loading={starting} onClick={handleStart}>
          Start attempt
        </Button>
        <Button variant="ghost" size="md" loading={removing} onClick={handleDelete}>
          Delete quiz
        </Button>
      </div>

      <div className={styles.history}>
        <h3 className={styles.historyTitle}>Attempt history</h3>
        {attempts === null ? (
          <p className={styles.historyEmpty}>Loading attempts…</p>
        ) : attempts.length === 0 ? (
          <p className={styles.historyEmpty}>No attempts yet.</p>
        ) : (
          <ul className={styles.attemptList}>
            {attempts.map((attempt, index) => (
              <li key={attempt.id}>
                <button
                  type="button"
                  className={styles.attemptRow}
                  onClick={() => {
                    if (attempt.status === "in-progress") {
                      onStartAttempt(attempt);
                    } else {
                      onOpenResults(attempt.id);
                    }
                  }}
                >
                  <span>Attempt {attempts.length - index}</span>
                  <span className={styles.attemptStatus}>{attempt.status}</span>
                  <span>
                    {attempt.score !== null ? `${Math.round(attempt.score)}%` : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
