"use client";

import { useCallback, useMemo, useState } from "react";
import { DEFAULT_QUIZ_CONFIGURATION } from "@/lib/quiz";
import { validateQuiz, type QuizValidationErrors } from "@/lib/quizValidation";
import { useSidebarDrawer } from "@/components/layout/AppShell";
import { useSettings } from "@/components/settings/SettingsProvider";
import { useToast } from "@/components/ui/Toast";
import { quizService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type {
  QuizConfiguration,
  QuizDefaults,
  QuizLanguage,
} from "@/types";
import type {
  QuizAttemptResponse,
  QuizAttemptResponse as Attempt,
  QuizResponse,
} from "@/lib/api/contracts";
import { QuizHeader } from "./QuizHeader";
import { QuizIntroduction } from "./QuizIntroduction";
import { QuizConfigurationSection } from "./QuizConfigurationSection";
import { QuizSourceSection } from "./QuizSourceSection";
import { QuizAdvancedSection } from "./QuizAdvancedSection";
import { QuizGenerationAction } from "./QuizGenerationAction";
import { QuizLibrary } from "./QuizLibrary";
import { QuizOverview } from "./QuizOverview";
import { QuizPlayer } from "./QuizPlayer";
import { QuizResults } from "./QuizResults";
import styles from "./QuizWorkspace.module.css";

const NO_ERRORS: QuizValidationErrors = {};

/** Seeds the builder from the Quiz defaults in Settings, keeping the builder's
 * own required-topic semantics intact. */
function seedFromDefaults(defaults: QuizDefaults): QuizConfiguration {
  return {
    ...DEFAULT_QUIZ_CONFIGURATION,
    subject: defaults.subject,
    questionCount: defaults.questionCount,
    difficulty: defaults.difficulty,
    questionType: defaults.questionType,
    academicLevel: defaults.academicLevel,
    source: defaults.source,
    databaseShare: defaults.databaseShare,
    explanations: defaults.explanations,
    shuffleQuestions: defaults.shuffleQuestions,
    shuffleAnswers: defaults.shuffleAnswers,
    timeLimitEnabled: defaults.timeLimitEnabled,
    timeLimitMinutes: defaults.timeLimitMinutes,
    // The stored document keeps the language as a free string so the schema can
    // accept future locales; the builder falls back when it is not one of the
    // options it can render.
    language: (["en", "pt-BR", "es", "fr", "de"] as const).includes(
      defaults.language as QuizLanguage
    )
      ? (defaults.language as QuizLanguage)
      : DEFAULT_QUIZ_CONFIGURATION.language,
  };
}

type View =
  | { name: "builder" }
  | { name: "overview"; quiz: QuizResponse }
  | { name: "player"; quiz: QuizResponse; attempt: Attempt }
  | { name: "results"; quiz: QuizResponse; attemptId: string };

/**
 * Quiz workspace composition. The builder configures quizzes, and real
 * generation, attempts and results live behind explicit view switches so the
 * local builder state is never confused with server state.
 *
 * Initial values come from the Quiz defaults in Settings. Editing here only
 * changes the current quiz, never the global defaults.
 */
export function QuizWorkspace() {
  const { drawerOpen, openDrawer } = useSidebarDrawer();
  const { settings } = useSettings();
  const [config, setConfig] = useState<QuizConfiguration>(() =>
    seedFromDefaults(settings.quiz)
  );
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>({ name: "builder" });
  const [libraryKey, setLibraryKey] = useState(0);
  const { notify } = useToast();

  const update = useCallback((patch: Partial<QuizConfiguration>) => {
    setConfig((current) => ({ ...current, ...patch }));
  }, []);

  const validation = useMemo(() => validateQuiz(config), [config]);
  const ready = Object.keys(validation).length === 0;
  // Errors are only surfaced after the first save attempt, so a fresh form
  // reads as a setup wizard rather than a wall of red.
  const errors = attempted ? validation : NO_ERRORS;

  const handleSubmit = useCallback(async () => {
    setAttempted(true);
    if (!ready || saving) return;

    setSaving(true);
    try {
      const { quiz } = await quizService.create({
        title: config.topic || config.subject || "Untitled quiz",
        subject: config.subject,
        topic: config.topic,
        difficulty: config.difficulty,
        questionType: config.questionType,
        academicLevel: config.academicLevel,
        questionCount: config.questionCount,
        sourceMode: config.source,
        timeLimit: config.timeLimitEnabled ? config.timeLimitMinutes : null,
        status: "ready",
        configuration: {
          contentMode: config.contentMode,
          language: config.language,
          explanations: config.explanations,
          shuffleQuestions: config.shuffleQuestions,
          shuffleAnswers: config.shuffleAnswers,
          aiStyle: config.aiStyle,
          databaseShare: config.databaseShare,
          databaseSource: config.databaseSource,
          institution: config.institution,
          year: config.year,
          academicLevel: config.academicLevel,
          customInstructions: config.customInstructions,
          fileIds: config.files
            .filter((file) => file.status === "ready")
            .map((file) => file.id),
        },
      });

      notify({
        tone: "success",
        title: "Quiz generated",
        description: "Questions are validated and stored on your account.",
      });
      setLibraryKey((key) => key + 1);
      setView({ name: "overview", quiz });
    } catch (cause) {
      // Preserve the configuration so a failed generation never loses work.
      notify({
        tone: "error",
        title: "Could not generate the quiz",
        description:
          cause instanceof ApiError ? cause.message : "The quiz was not created.",
      });
    } finally {
      setSaving(false);
    }
  }, [config, notify, ready, saving]);

  const handleStartAttempt = useCallback(
    (quiz: QuizResponse, attempt: QuizAttemptResponse) => {
      setView({ name: "player", quiz, attempt });
    },
    []
  );

  const handleRetry = useCallback(
    async (quiz: QuizResponse) => {
      try {
        const attempt = await quizService.startAttempt(quiz.id);
        setView({ name: "player", quiz, attempt });
        setLibraryKey((key) => key + 1);
      } catch (cause) {
        notify({
          tone: "error",
          title: "Could not start a new attempt",
          description:
            cause instanceof ApiError ? cause.message : "Please try again.",
        });
      }
    },
    [notify]
  );

  return (
    <div className={styles.workspace}>
      <div className={styles.scroll}>
        <div className={styles.column}>
          <QuizHeader
            title={
              view.name === "builder"
                ? "Quiz builder"
                : view.name === "overview"
                  ? "Quiz"
                  : view.name === "player"
                    ? "Attempt"
                    : "Results"
            }
            description={
              view.name === "builder"
                ? "Configure a quiz before generating it. Every block below is reviewed here, in this workspace."
                : "Your quiz, your attempts, graded by the server."
            }
            meta={["Saved to your account", "AI, database and web sources labelled"]}
            onOpenDrawer={openDrawer}
            drawerOpen={drawerOpen}
          />

          {view.name === "builder" ? (
            <>
              <QuizIntroduction />
              <div className={styles.blocks}>
                <QuizConfigurationSection config={config} update={update} errors={errors} />
                <QuizSourceSection config={config} update={update} errors={errors} />
                <QuizAdvancedSection config={config} update={update} />
              </div>
              <QuizGenerationAction
                config={config}
                ready={ready}
                attempted={attempted}
                saving={saving}
                onSubmit={() => void handleSubmit()}
              />
              <QuizLibrary
                refreshKey={libraryKey}
                onOpen={(quiz) => setView({ name: "overview", quiz })}
              />
            </>
          ) : null}

          {view.name === "overview" ? (
            <QuizOverview
              quiz={view.quiz}
              onStartAttempt={(attempt) => handleStartAttempt(view.quiz, attempt)}
              onOpenResults={(attemptId) =>
                setView({ name: "results", quiz: view.quiz, attemptId })
              }
              onBack={() => setView({ name: "builder" })}
              onDeleted={() => {
                setLibraryKey((key) => key + 1);
                setView({ name: "builder" });
              }}
            />
          ) : null}

          {view.name === "player" ? (
            <QuizPlayer
              attempt={view.attempt}
              onFinished={(attemptId) => {
                setLibraryKey((key) => key + 1);
                setView({ name: "results", quiz: view.quiz, attemptId });
              }}
              onExit={() => setView({ name: "overview", quiz: view.quiz })}
            />
          ) : null}

          {view.name === "results" ? (
            <QuizResults
              attemptId={view.attemptId}
              onRetry={() => void handleRetry(view.quiz)}
              onBack={() => setView({ name: "overview", quiz: view.quiz })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
