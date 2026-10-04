"use client";

import { useEffect, useState } from "react";
import { quizService } from "@/lib/api/services";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "./SectionCard";
import styles from "./QuizResults.module.css";

type QuizResultsProps = {
  attemptId: string;
  onRetry: () => void;
  onBack: () => void;
};

/**
 * Results after the server has finalized the attempt: real score, real
 * counts, and a per-question review with the correct answers and the
 * explanations stored on the questions.
 */
export function QuizResults({ attemptId, onRetry, onBack }: QuizResultsProps) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof quizService.getAttempt>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    quizService
      .getAttempt(attemptId)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the results.");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (error) {
    return (
      <SectionCard id="quiz-results" title="Results">
        <p className={styles.muted}>{error}</p>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </SectionCard>
    );
  }

  if (!data) {
    return (
      <SectionCard id="quiz-results" title="Results">
        <p className={styles.muted}>Loading results…</p>
      </SectionCard>
    );
  }

  const { attempt, answers, questions } = data;
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

  return (
    <SectionCard
      id="quiz-results"
      title="Results"
      description={
        attempt.status === "expired"
          ? "Time ran out — graded with the answers saved."
          : "Graded on the server from your stored answers."
      }
      action={
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      }
    >
      <div className={styles.scoreRow}>
        <span className={styles.score}>
          {attempt.score !== null ? `${Math.round(attempt.score)}%` : "—"}
        </span>
        <dl className={styles.counts}>
          <div>
            <dt>Correct</dt>
            <dd>{attempt.correctCount}</dd>
          </div>
          <div>
            <dt>Incorrect</dt>
            <dd>{attempt.incorrectCount}</dd>
          </div>
          <div>
            <dt>Unanswered</dt>
            <dd>{attempt.unansweredCount}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              {attempt.durationSeconds !== null
                ? `${Math.floor(attempt.durationSeconds / 60)}:${String(
                    attempt.durationSeconds % 60
                  ).padStart(2, "0")}`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <ol className={styles.review}>
        {questions.map((question, index) => {
          const answer = byQuestion.get(question.id);
          const correct = answer?.isCorrect === true;
          return (
            <li key={question.id} className={styles.reviewItem}>
              <div className={styles.reviewHead}>
                <span className={styles.reviewIndex}>
                  Question {index + 1}
                </span>
                <span className={styles.reviewMeta}>
                  <span className={styles.sourceChip}>
                    {question.source === "database"
                      ? "Database"
                      : question.source === "web"
                        ? "Web"
                        : question.source === "file"
                          ? "File"
                          : question.source === "mixed"
                            ? "Mixed"
                            : "AI"}
                  </span>
                  <span
                    className={
                      answer
                        ? correct
                          ? styles.badgeCorrect
                          : styles.badgeIncorrect
                        : styles.badgeUnanswered
                    }
                  >
                    {answer ? (correct ? "Correct" : "Incorrect") : "Unanswered"}
                  </span>
                </span>
              </div>
              <p className={styles.reviewStatement}>{question.statement}</p>
              <p className={styles.reviewLine}>
                <strong>Your answer:</strong>{" "}
                {answer?.selectedAnswer ?? "—"}
              </p>
              <p className={styles.reviewLine}>
                <strong>Correct answer:</strong> {question.correctAnswer ?? "—"}
              </p>
              {question.explanation ? (
                <p className={styles.explanation}>{question.explanation}</p>
              ) : null}
              {question.source === "file" && question.sourceMetadata ? (
                <p className={styles.explanation}>
                  Source:{" "}
                  {Array.isArray((question.sourceMetadata as { files?: { filename: string }[] }).files) &&
                  ((question.sourceMetadata as { files?: { filename: string }[] }).files?.length ?? 0) > 0
                    ? (question.sourceMetadata as { files: { filename: string }[] }).files
                        .map((file) => file.filename)
                        .join(", ")
                    : "uploaded file"}
                  {typeof (question.sourceMetadata as { page?: unknown }).page === "number"
                    ? ` — page ${(question.sourceMetadata as { page: number }).page}`
                    : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className={styles.actions}>
        <Button variant="primary" size="md" onClick={onRetry}>
          Retry quiz
        </Button>
      </div>
    </SectionCard>
  );
}
