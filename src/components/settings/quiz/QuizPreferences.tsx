"use client";

import { useSettings } from "../SettingsProvider";
import { useSettingsFocus } from "../useSettingsFocus";
import {
  SettingsGroup,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from "../SettingsSection";
import { ResetSettingsDialog } from "../dialogs/ResetSettingsDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { CountStepper } from "@/components/quiz/CountStepper";
import { Slider } from "@/components/ui/Slider";
import { InfoIcon } from "@/components/ui/icons";
import {
  ACADEMIC_LEVEL_OPTIONS,
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
  QUESTION_TYPE_OPTIONS,
  SOURCE_MODE_OPTIONS,
} from "@/lib/quiz";
import { SETTINGS_SECTION_META } from "@/lib/settingsRegistry";
import type { QuizOption } from "@/types";
import styles from "./QuizPreferences.module.css";

const BASE_SOURCE_OPTIONS: QuizOption<"ai" | "database" | "mixed">[] =
  SOURCE_MODE_OPTIONS.map((option) => ({
    value: option.value,
    label:
      option.value === "ai"
        ? "AI generated"
        : option.value === "database"
          ? "Database / external"
          : "Mixed",
    description: option.description,
  }));

/**
 * Quiz defaults section. These values prefill the Quiz builder; they never lock
 * an individual quiz, which always keeps its own current-session values.
 */
export function QuizPreferences() {
  const { settings, update, dirtySections } = useSettings();
  useSettingsFocus();
  const quiz = settings.quiz;
  const dirty = dirtySections.includes("quiz");

  return (
    <SettingsSection
      {...SETTINGS_SECTION_META.quiz}
      action={dirty ? <StatusPill tone="warning">Unsaved</StatusPill> : null}
    >
      <SettingsGroup
        title="Starting values"
        description="Applied when the Quiz builder opens."
      >
        <SettingsRow
          title="Default subject"
          description="Leave empty to start with no subject selected."
          entryId="quiz.subject"
          layout="stacked"
          control={
            <input
              className={styles.input}
              value={quiz.subject}
              onChange={(event) => update("quiz", { subject: event.target.value })}
              placeholder="e.g. Mathematics"
              aria-label="Default subject"
            />
          }
        />

        <SettingsRow
          title="Default number of questions"
          description={`Between ${QUESTION_COUNT_MIN} and ${QUESTION_COUNT_MAX}.`}
          entryId="quiz.questionCount"
          layout="stacked"
          controlWidth="auto"
          control={
            <CountStepper
              value={quiz.questionCount}
              min={QUESTION_COUNT_MIN}
              max={QUESTION_COUNT_MAX}
              onChange={(questionCount) => update("quiz", { questionCount })}
              ariaLabel="Default number of questions"
            />
          }
        />

        <SettingsRow
          title="Default difficulty"
          description="Difficulty pre-filled for a new quiz."
          entryId="quiz.difficulty"
          layout="stacked"
          control={
            <SegmentedControl
              name="Default difficulty"
              size="sm"
              options={DIFFICULTY_OPTIONS}
              value={quiz.difficulty}
              onChange={(difficulty) => update("quiz", { difficulty })}
            />
          }
        />

        <SettingsRow
          title="Default question type"
          description="Shape of each question."
          entryId="quiz.questionType"
          layout="stacked"
          control={
            <SelectField
              label="Default question type"
              options={QUESTION_TYPE_OPTIONS}
              value={quiz.questionType}
              onChange={(questionType) => update("quiz", { questionType })}
            />
          }
        />

        <SettingsRow
          title="Default academic level"
          description="Expected depth of the questions."
          entryId="quiz.academicLevel"
          layout="stacked"
          control={
            <SelectField
              label="Default academic level"
              options={ACADEMIC_LEVEL_OPTIONS}
              value={quiz.academicLevel}
              onChange={(academicLevel) => update("quiz", { academicLevel })}
            />
          }
        />

        <SettingsRow
          title="Default language"
          description="Language quizzes are written in."
          entryId="quiz.language"
          layout="stacked"
          control={
            <SelectField
              label="Default language"
              options={LANGUAGE_OPTIONS}
              value={quiz.language}
              onChange={(language) => update("quiz", { language })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Question source preference">
        <SettingsRow
          title="Default source"
          description="AI writes questions from your configuration; a database retrieves existing questions; mixed combines both. No external database is connected yet."
          entryId="quiz.source"
          layout="stacked"
          control={
            <SegmentedControl
              name="Default question source"
              size="sm"
              options={BASE_SOURCE_OPTIONS}
              value={quiz.source}
              onChange={(source) => update("quiz", { source })}
            />
          }
        />

        {quiz.source === "mixed" ? (
          <SettingsRow
            title="AI / database mixing"
            description="Default balance for mixed-source quizzes."
            entryId="quiz.databaseShare"
            layout="stacked"
            control={
              <Slider
                label="Database share"
                min={0}
                max={100}
                step={5}
                value={quiz.databaseShare}
                onChange={(databaseShare) => update("quiz", { databaseShare })}
                formatValue={(value) =>
                  `${value}% database · ${100 - value}% AI`
                }
                minLabel="All AI"
                maxLabel="All database"
              />
            }
          />
        ) : null}

        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          Source preference only describes the request. It is not a claim that
          retrieval currently happens.
        </SettingsNote>
      </SettingsGroup>

      <SettingsGroup title="Attempt defaults">
        <SettingsSwitchRow
          title="Show explanations"
          description="Include rationale after each answer by default."
          checked={quiz.explanations}
          onChange={(explanations) => update("quiz", { explanations })}
          htmlFor="quiz-explanations"
          entryId="quiz.explanations"
        />

        <SettingsSwitchRow
          title="Shuffle questions"
          description="Randomise the order of the question set."
          checked={quiz.shuffleQuestions}
          onChange={(shuffleQuestions) => update("quiz", { shuffleQuestions })}
          htmlFor="quiz-shuffle-questions"
          entryId="quiz.shuffleQuestions"
        />

        <SettingsSwitchRow
          title="Shuffle answers"
          description="Randomise the option order inside each question."
          checked={quiz.shuffleAnswers}
          onChange={(shuffleAnswers) => update("quiz", { shuffleAnswers })}
          htmlFor="quiz-shuffle-answers"
          entryId="quiz.shuffleAnswers"
        />

        <SettingsSwitchRow
          title="Time limit"
          description="Apply a time limit to quizzes by default."
          checked={quiz.timeLimitEnabled}
          onChange={(timeLimitEnabled) => update("quiz", { timeLimitEnabled })}
          htmlFor="quiz-time-limit"
          entryId="quiz.timeLimitEnabled"
        />

        {quiz.timeLimitEnabled ? (
          <SettingsRow
            title="Default minutes"
            description="Applied when a quiz starts."
            entryId="quiz.timeLimitMinutes"
            layout="stacked"
            controlWidth="auto"
            control={
              <CountStepper
                value={quiz.timeLimitMinutes}
                min={1}
                max={180}
                onChange={(timeLimitMinutes) =>
                  update("quiz", { timeLimitMinutes })
                }
                ariaLabel="Default time limit in minutes"
              />
            }
          />
        ) : null}
      </SettingsGroup>

      <div className={styles.footer}>
        <SettingsNote tone="neutral" icon={<InfoIcon size={14} />}>
          The Quiz builder uses these as initial values. Any individual quiz can
          override them without changing the defaults.
        </SettingsNote>
        <ResetSettingsDialog target="quiz" label="Reset Quiz defaults" />
      </div>
    </SettingsSection>
  );
}