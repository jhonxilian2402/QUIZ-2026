"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { SectionCard } from "./SectionCard";
import { SubjectSelector } from "./SubjectSelector";
import { ContentModeSelector } from "./ContentModeSelector";
import { FileUpload } from "./FileUpload";
import { CountStepper } from "./CountStepper";
import { SelectField } from "@/components/ui/SelectField";
import { ComposerSurface } from "@/components/ui/Textarea";
import { InfoIcon } from "@/components/ui/icons";
import {
  DIFFICULTY_OPTIONS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from "@/lib/quiz";
import {
  needsFiles,
  needsInstructions,
  needsTopic,
  type QuizValidationErrors,
} from "@/lib/quizValidation";
import type { QuizConfiguration } from "@/types";
import styles from "./QuizConfigurationSection.module.css";

type QuizConfigurationSectionProps = {
  config: QuizConfiguration;
  update: (patch: Partial<QuizConfiguration>) => void;
  errors: QuizValidationErrors;
};

const TOPIC_EXPLAINER =
  "A chapter, concept, subtopic or a set of keywords. The narrower it is, the more focused the quiz becomes.";

/**
 * Required setup block. Subject, topic/content and the base size/difficulty
 * live here; everything optional is deferred to the advanced block.
 */
export function QuizConfigurationSection({
  config,
  update,
  errors,
}: QuizConfigurationSectionProps) {
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const showTopic = needsTopic(config);
  const showFiles = needsFiles(config);
  const showInstructions = needsInstructions(config);

  return (
    <SectionCard
      id="quiz-configuration"
      index={1}
      title="Quiz configuration"
      description="What the quiz is about and how much of it there should be."
    >
      <Field
        label="Subject"
        required
        hint="Pick a predefined subject or add your own."
        error={errors.subject}
      >
        <SubjectSelector
          value={config.subject}
          onChange={(subject) => update({ subject })}
        />
      </Field>

      <Field label="Content" hint="Choose how the quiz should be grounded.">
        <ContentModeSelector
          value={config.contentMode}
          onChange={(contentMode) => update({ contentMode })}
        />
      </Field>

      {showTopic ? (
        <Field
          label="Topic"
          required
          hint={TOPIC_EXPLAINER}
          error={errors.topic}
        >
          <input
            className={styles.topicInput}
            value={config.topic}
            onChange={(event) => update({ topic: event.target.value })}
            placeholder={
              config.subject
                ? `e.g. ${config.subject} — a specific chapter or concept`
                : "e.g. Quadratic equations"
            }
            aria-label="Topic"
          />
        </Field>
      ) : null}

      {showFiles ? (
        <Field
          label="Material"
          required
          hint="Files are uploaded to your account and processed (text extracted) before they can ground a quiz."
          error={errors.files}
        >
          <FileUpload
            files={config.files}
            onChange={(files) => update({ files })}
            errors={fileErrors}
            onError={(message) => setFileErrors([message])}
          />
        </Field>
      ) : null}

      {showInstructions ? (
        <Field
          label="Custom instructions"
          required
          hint="Describe scope, format and anything the quiz must include."
          error={errors.customInstructions}
        >
          <ComposerSurface
            value={config.customInstructions}
            onValueChange={(customInstructions) => update({ customInstructions })}
            placeholder="e.g. Focus on decoding, include two interpretation questions and avoid dates before 1900."
            ariaLabel="Custom instructions"
            maxRows={7}
            className={styles.instructions}
            bodyClassName={styles.instructionsBody}
            textareaClassName={styles.instructionsTextarea}
          />
        </Field>
      ) : null}

      <div className={styles.row}>
        <Field
          label="Number of questions"
          hint={`Between ${QUESTION_COUNT_MIN} and ${QUESTION_COUNT_MAX}.`}
          htmlFor="quiz-count"
        >
          <CountStepper
            id="quiz-count"
            value={config.questionCount}
            min={QUESTION_COUNT_MIN}
            max={QUESTION_COUNT_MAX}
            onChange={(questionCount) => update({ questionCount })}
            ariaLabel="Number of questions"
            className={styles.compactControl}
          />
        </Field>

        <Field label="Difficulty">
          <SelectField
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={config.difficulty}
            onChange={(difficulty) => update({ difficulty })}
          />
        </Field>
      </div>

      <p className={styles.note}>
        <span className={styles.noteIcon}>
          <InfoIcon size={14} />
        </span>
        Adjust every block first, then generate from the action at the bottom.
      </p>
    </SectionCard>
  );
}