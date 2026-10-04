"use client";

import { Field } from "@/components/ui/Field";
import { SectionCard } from "./SectionCard";
import { SourceModeSelector } from "./SourceModeSelector";
import { CompositionSlider } from "./CompositionSlider";
import { SelectField } from "@/components/ui/SelectField";
import { Input } from "@/components/ui/Input";
import {
  DATABASE_SOURCE_OPTIONS,
} from "@/lib/quiz";
import { needsDatabase, type QuizValidationErrors } from "@/lib/quizValidation";
import type { QuizConfiguration } from "@/types";
import styles from "./QuizSourceSection.module.css";

type QuizSourceSectionProps = {
  config: QuizConfiguration;
  update: (patch: Partial<QuizConfiguration>) => void;
  errors: QuizValidationErrors;
};

/**
 * Source block. The three modes are always explicit, and the database-only
 * fields are progressively disclosed rather than duplicated.
 */
export function QuizSourceSection({
  config,
  update,
  errors,
}: QuizSourceSectionProps) {
  const database = needsDatabase(config);

  return (
    <SectionCard
      id="quiz-source"
      index={2}
      title="Question source"
      description="Decide where the questions should come from before choosing their shape."
      badge={
        <span className={styles.modeBadge}>
          {config.source === "ai"
            ? "AI only"
            : config.source === "database"
              ? "Database only"
              : "Mixed"}
        </span>
      }
    >
      <SourceModeSelector
        value={config.source}
        onChange={(source) => update({ source })}
      />

      {database ? (
        <div className={styles.databaseBlock}>
          <div className={styles.row}>
            <Field
              label="Database source"
              required
              error={errors.databaseSource}
              hint="Where retrieved questions should come from."
            >
              <SelectField
                label="Database source"
                options={DATABASE_SOURCE_OPTIONS}
                value={config.databaseSource}
                onChange={(databaseSource) => update({ databaseSource })}
              />
            </Field>

            <Field label="Institution" hint="Optional. Narrow the provenance.">
              <Input
                value={config.institution}
                onChange={(event) => update({ institution: event.target.value })}
                placeholder="e.g. ENEM, SAT, local university"
                aria-label="Institution"
              />
            </Field>
          </div>

          <Field label="Year" hint="Optional. Restrict to a period.">
            <Input
              value={config.year}
              onChange={(event) => update({ year: event.target.value })}
              placeholder="e.g. 2023 or 2018-2024"
              aria-label="Year"
              inputMode="numeric"
            />
          </Field>

          {config.source === "mixed" ? (
            <Field
              label="Composition"
              hint="Balance between the database and the model."
            >
              <CompositionSlider
                value={config.databaseShare}
                onChange={(databaseShare) => update({ databaseShare })}
                total={config.questionCount}
              />
            </Field>
          ) : null}

          <p className={styles.note}>
            No questions are retrieved in this phase. These settings only
            describe the request the builder will send.
          </p>
        </div>
      ) : (
        <p className={styles.note}>
          AI mode uses the subject, content and advanced settings you select
          here. Database options stay hidden until a retrieval mode is chosen.
        </p>
      )}
    </SectionCard>
  );
}