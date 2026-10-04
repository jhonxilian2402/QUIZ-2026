"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quizService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "./SectionCard";
import type {
  QuizAnswerResponse,
  QuizAttemptResponse,
  QuizQuestionResponse,
} from "@/lib/api/contracts";
import styles from "./QuizPlayer.module.css";

type QuizPlayerProps = {
  attempt: QuizAttemptResponse;
  onFinished: (attemptId: string) => void;
  onExit: () => void;
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Quiz taker. Questions and the correct-answer key never reach the browser
 * while the attempt is open: this view reads through the attempt endpoint,
 * which withholds `correctAnswer` until the attempt is finalized server-side.
 */
export function QuizPlayer({ attempt, onFinished, onExit }: QuizPlayerProps) {
  const { notify } = useToast();
  const [questions, setQuestions] = useState<QuizQuestionResponse[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswerResponse>>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    quizService
      .getAttempt(attempt.id)
      .then(({ attempt: serverAttempt, questions, answers }) => {
        if (cancelled) return;
        // A reopened attempt may already be final server-side (completed or
        // expired); never render it as playable again.
        if (serverAttempt.status !== "in-progress") {
          onFinished(attempt.id);
          return;
        }
        setQuestions(questions);
        setAnswers(
          Object.fromEntries(answers.map((answer) => [answer.questionId, answer]))
        );
      })
      .catch((cause) => {
        if (!cancelled) {
          setQuestions([]);
          notify({
            tone: "error",
            title: "Could not load the attempt",
            description:
              cause instanceof ApiError ? cause.message : "Please try again.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // onFinished is a stable view transition; attempt.id is the only real
    // dependency for reloading attempt data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id, notify]);

  const expiresAt = attempt.expiresAt ? Date.parse(attempt.expiresAt) : null;

  const handleFinish = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinishing(true);
    try {
      await quizService.completeAttempt(attempt.id);
      onFinished(attempt.id);
    } catch (cause) {
      finishedRef.current = false;
      notify({
        tone: "error",
        title: "Could not submit the quiz",
        description: cause instanceof ApiError ? cause.message : "Please try again.",
      });
    } finally {
      setFinishing(false);
    }
  }, [attempt.id, notify, onFinished]);

  // Tick the countdown; when it hits zero the server, not the client,
  // decides the attempt expired — we only trigger the completion call.
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (expiresAt !== null && now >= expiresAt && !finishedRef.current) {
      void handleFinish();
    }
  }, [expiresAt, now, handleFinish]);

  const remaining = useMemo(
    () => (expiresAt === null ? null : Math.max(0, expiresAt - now)),
    [expiresAt, now]
  );

  const handleSelect = useCallback(
    async (questionId: string, selectedAnswer: string) => {
      const current = answers[questionId];
      if (current?.selectedAnswer === selectedAnswer) return;
      setSubmitting(true);
      // Optimistic selection; kept locally even when the network fails.
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          id: prev[questionId]?.id ?? `pending-${questionId}`,
          attemptId: attempt.id,
          questionId,
          selectedAnswer,
          isCorrect: prev[questionId]?.isCorrect ?? false,
          answeredAt: new Date().toISOString(),
        },
      }));
      try {
        const saved = await quizService.submitAnswer(attempt.id, questionId, selectedAnswer);
        setAnswers((prev) => ({ ...prev, [questionId]: saved }));
      } catch (cause) {
        notify({
          tone: "error",
          title: "Answer not saved",
          description:
            cause instanceof ApiError ? cause.message : "Your selection is kept; try again.",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [answers, attempt.id, notify]
  );

  if (questions === null) {
    return (
      <SectionCard id="quiz-player" title="Loading attempt">
        <p className={styles.muted}>Preparing your questions…</p>
      </SectionCard>
    );
  }

  if (questions.length === 0) {
    return (
      <SectionCard id="quiz-player" title="No questions">
        <p className={styles.muted}>This attempt has no questions to answer.</p>
        <Button variant="ghost" size="sm" onClick={onExit}>
          Back
        </Button>
      </SectionCard>
    );
  }

  const question = questions[index];
  const answeredCount = Object.values(answers).filter(
    (answer) => answer.selectedAnswer !== null
  ).length;
  const isLast = index === questions.length - 1;

  return (
    <SectionCard
      id="quiz-player"
      title={`Question ${index + 1} of ${questions.length}`}
      description={`${answeredCount} answered`}
      action={
        <div className={styles.headActions}>
          {remaining !== null ? (
            <span
              className={remaining < 60_000 ? styles.timerUrgent : styles.timer}
              role="timer"
              aria-live="off"
            >
              {formatRemaining(remaining)}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onExit}>
            Leave
          </Button>
        </div>
      }
    >
      <div className={styles.progress} aria-hidden>
        <span
          className={styles.progressFill}
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <p className={styles.statement}>{question.statement}</p>

      <div className={styles.options} role="radiogroup" aria-label="Answer options">
        {question.options.map((option) => {
          const selected = answers[question.id]?.selectedAnswer === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? styles.optionSelected : styles.option}
              onClick={() => void handleSelect(question.id, option.id)}
              disabled={submitting || finishing}
            >
              <span className={styles.optionId}>{option.id}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.footer}>
        <Button
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          Previous
        </Button>
        {isLast ? (
          <Button variant="primary" size="md" loading={finishing} onClick={() => void handleFinish()}>
            Finish quiz
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={() => setIndex((value) => value + 1)}>
            Next
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
