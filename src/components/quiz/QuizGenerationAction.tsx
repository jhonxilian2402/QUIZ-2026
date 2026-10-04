"use client";

import { Button } from "@/components/ui/Button";
import {
  ArrowUpIcon,
  DatabaseIcon,
  LayersIcon,
  SparkIcon,
} from "@/components/ui/icons";
import {
  ACADEMIC_LEVEL_OPTIONS,
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  SOURCE_MODE_OPTIONS,
} from "@/lib/quiz";
import { needsDatabase } from "@/lib/quizValidation";
import type { QuizConfiguration, QuizSourceMode } from "@/types";
import styles from "./QuizGenerationAction.module.css";

type QuizGenerationActionProps = {
  config: QuizConfiguration;
  ready: boolean;
  attempted: boolean;
  saving: boolean;
  onSubmit: () => void;
};

function labelFrom<T extends string>(
  options: { value: T; label: string }[],
  value: T
): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

function sourceIcon(mode: QuizSourceMode) {
  if (mode === "database") return <DatabaseIcon size={15} />;
  if (mode === "mixed") return <LayersIcon size={15} />;
  return <SparkIcon size={15} />;
}

/**
 * Bottom confirmation block. It restates the current setup and exposes the
 * single generation action.
 */
export function QuizGenerationAction({
  config,
  ready,
  attempted,
  saving,
  onSubmit,
}: QuizGenerationActionProps) {
  const summary: { label: string; value: string }[] = [
    { label: "Subject", value: config.subject || "Not set" },
    {
      label: "Content",
      value:
        config.contentMode === "instructions"
          ? "Custom instructions"
          : config.contentMode === "upload"
            ? `${config.files.length} file${config.files.length === 1 ? "" : "s"}`
            : config.topic || "Not set",
    },
    { label: "Questions", value: String(config.questionCount) },
    {
      label: "Difficulty",
      value: labelFrom(DIFFICULTY_OPTIONS, config.difficulty),
    },
    {
      label: "Type",
      value: labelFrom(QUESTION_TYPE_OPTIONS, config.questionType),
    },
    {
      label: "Level",
      value: labelFrom(ACADEMIC_LEVEL_OPTIONS, config.academicLevel),
    },
    { label: "Language", value: labelFrom(LANGUAGE_OPTIONS, config.language) },
    {
      label: "Timing",
      value: config.timeLimitEnabled ? `${config.timeLimitMinutes} min` : "Untimed",
    },
  ];

  if (needsDatabase(config)) {
    summary.push({
      label: "Database",
      value: config.databaseSource || "Not set",
    });
  }

  const status = ready
    ? {
        tone: "ready" as const,
        title: "Configuration complete",
        hint: saving
          ? "Generating questions — this can take up to a minute."
          : "Ready to generate a real quiz through your AI provider.",
      }
    : attempted
      ? {
          tone: "error" as const,
          title: "Some required fields are missing",
          hint: "Review the highlighted fields in the blocks above.",
        }
      : {
          tone: "idle" as const,
          title: "Fill in the required fields",
          hint: "Required fields are marked with an asterisk.",
        };

  return (
    <section
      id="quiz-generate"
      className={styles.root}
      aria-labelledby="quiz-generate-title"
    >
      <div className={styles.summaryHead}>
        <h2 id="quiz-generate-title" className={styles.title}>
          Review and generate
        </h2>
        <span className={styles.sourceChip}>
          {sourceIcon(config.source)}
          {labelFrom(SOURCE_MODE_OPTIONS, config.source)}
        </span>
      </div>

      <dl className={styles.summary}>
        {summary.map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>{item.label}</dt>
            <dd className={styles.summaryValue} title={item.value}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.action}>
        <div className={styles.actionText}>
          <span className={styles.statusRow}>
            <span className={styles[status.tone]} aria-hidden />
            <span className={styles.actionTitle}>{status.title}</span>
          </span>
          <span className={styles.actionHint}>{status.hint}</span>
        </div>
        <Button
          variant="primary"
          size="md"
          disabled={!ready}
          loading={saving}
          onClick={onSubmit}
          trailingIcon={<ArrowUpIcon size={15} />}
        >
          {saving ? "Generating…" : "Generate quiz"}
        </Button>
      </div>

      <p className={styles.disclaimer} role="status">
        Generation calls your configured AI provider, validates every question
        on the server and stores the quiz on your account. Nothing is invented
        client-side.
      </p>
    </section>
  );
}