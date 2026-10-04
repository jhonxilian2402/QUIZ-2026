"use client";

import { useMemo } from "react";
import { Collapsible } from "./Collapsible";
import { Field } from "@/components/ui/Field";
import { SectionCard } from "./SectionCard";
import { SelectField } from "@/components/ui/SelectField";
import { CountStepper } from "./CountStepper";
import { Switch, SwitchRow } from "@/components/ui/Switch";
import { ComposerSurface } from "@/components/ui/Textarea";
import {
  ACADEMIC_LEVEL_OPTIONS,
  AI_STYLE_OPTIONS,
  LANGUAGE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  TIME_LIMIT_OPTIONS,
} from "@/lib/quiz";
import type { QuizConfiguration } from "@/types";
import styles from "./QuizAdvancedSection.module.css";

type QuizAdvancedSectionProps = {
  config: QuizConfiguration;
  update: (patch: Partial<QuizConfiguration>) => void;
};

/**
 * Optional refinement block. AI-specific settings are only rendered for AI and
 * mixed sources; general settings stay visible for every mode.
 */
export function QuizAdvancedSection({ config, update }: QuizAdvancedSectionProps) {
  const aiActive = config.source === "ai" || config.source === "mixed";

  // The preset select is a shortcut, not the source of truth: a custom value
  // from the stepper is kept as-is instead of being silently swapped.
  const timeLimitOptions = useMemo(() => {
    const current = String(config.timeLimitMinutes);
    if (TIME_LIMIT_OPTIONS.some((option) => option.value === current)) {
      return TIME_LIMIT_OPTIONS;
    }
    return [
      { value: current, label: `${current} minutes (custom)` },
      ...TIME_LIMIT_OPTIONS,
    ];
  }, [config.timeLimitMinutes]);

  return (
    <SectionCard
      id="quiz-advanced"
      index={3}
      title="Advanced options"
      description="Optional. Everything here has a sensible default."
    >
      <div className={styles.grid}>
        <Field label="Question type" hint="Shape of each generated question.">
          <SelectField
            label="Question type"
            options={QUESTION_TYPE_OPTIONS}
            value={config.questionType}
            onChange={(questionType) => update({ questionType })}
          />
        </Field>

        <Field label="Academic level" hint="Sets the expected depth.">
          <SelectField
            label="Academic level"
            options={ACADEMIC_LEVEL_OPTIONS}
            value={config.academicLevel}
            onChange={(academicLevel) => update({ academicLevel })}
          />
        </Field>

        <Field label="Language" hint="Language the quiz is written in.">
          <SelectField
            label="Language"
            options={LANGUAGE_OPTIONS}
            value={config.language}
            onChange={(language) => update({ language })}
          />
        </Field>

        {aiActive ? (
          <Field label="Question style" hint="Tone and reasoning depth.">
            <SelectField
              label="Question style"
              options={AI_STYLE_OPTIONS}
              value={config.aiStyle}
              onChange={(aiStyle) => update({ aiStyle })}
            />
          </Field>
        ) : null}
      </div>

      <Collapsible
        title="Timing"
        description="Add a time limit for the attempt."
        defaultOpen={config.timeLimitEnabled}
        trailing={
          <Switch
            checked={config.timeLimitEnabled}
            onChange={(timeLimitEnabled) => update({ timeLimitEnabled })}
            aria-label="Enable time limit"
          />
        }
      >
        <div className={styles.grid}>
          <Field
            label="Minutes"
            hint="Applied once the quiz session starts."
            htmlFor="quiz-time-limit"
          >
            <CountStepper
              id="quiz-time-limit"
              value={config.timeLimitMinutes}
              min={1}
              max={180}
              onChange={(timeLimitMinutes) => update({ timeLimitMinutes })}
              ariaLabel="Time limit in minutes"
            />
          </Field>
          <Field label="Preset" hint="Quick values for common durations.">
            <SelectField
              label="Time limit preset"
              options={timeLimitOptions}
              value={String(config.timeLimitMinutes)}
              onChange={(value) => update({ timeLimitMinutes: Number(value) })}
            />
          </Field>
        </div>
      </Collapsible>

      <Collapsible
        title="Attempt rules"
        description="Ordering of questions and answers."
        defaultOpen
      >
        <div className={styles.switches}>
          <SwitchRow
            label="Show explanations"
            description="Reveal the rationale after each answer."
            checked={config.explanations}
            onChange={(explanations) => update({ explanations })}
            htmlFor="quiz-explanations"
          />
          <SwitchRow
            label="Shuffle questions"
            description="Randomise the order of the question set."
            checked={config.shuffleQuestions}
            onChange={(shuffleQuestions) => update({ shuffleQuestions })}
            htmlFor="quiz-shuffle-questions"
          />
          <SwitchRow
            label="Shuffle answers"
            description="Randomise the option order inside each question."
            checked={config.shuffleAnswers}
            onChange={(shuffleAnswers) => update({ shuffleAnswers })}
            htmlFor="quiz-shuffle-answers"
          />
        </div>
      </Collapsible>

      {aiActive ? (
        <Field
          label="Custom instructions"
          hint="Optional extra guidance for the model."
        >
          <ComposerSurface
            value={config.customInstructions}
            onValueChange={(customInstructions) => update({ customInstructions })}
            placeholder="e.g. Prefer short stems, avoid trick questions and include one diagram-based item."
            ariaLabel="Custom instructions"
            maxRows={7}
            className={styles.instructions}
            bodyClassName={styles.instructionsBody}
            textareaClassName={styles.instructionsTextarea}
          />
        </Field>
      ) : null}
    </SectionCard>
  );
}