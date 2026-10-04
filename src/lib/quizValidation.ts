import type { QuizConfiguration } from "@/types";

export type QuizValidationErrors = Partial<
  Record<"subject" | "topic" | "files" | "databaseSource" | "customInstructions", string>
>;

export function needsTopic(config: QuizConfiguration): boolean {
  return config.contentMode === "topic" || config.contentMode === "topic+upload";
}

export function needsFiles(config: QuizConfiguration): boolean {
  return config.contentMode === "upload" || config.contentMode === "topic+upload";
}

export function needsInstructions(config: QuizConfiguration): boolean {
  return config.contentMode === "instructions";
}

export function needsDatabase(config: QuizConfiguration): boolean {
  return config.source === "database" || config.source === "mixed";
}

export function validateQuiz(config: QuizConfiguration): QuizValidationErrors {
  const errors: QuizValidationErrors = {};

  if (config.subject.trim().length === 0) {
    errors.subject = "Choose or add a subject.";
  }

  if (needsTopic(config) && config.topic.trim().length === 0) {
    errors.topic = "Describe the topic to cover.";
  }

  if (needsFiles(config) && config.files.length === 0) {
    errors.files = "Add at least one file to ground the quiz.";
  } else if (needsFiles(config) && config.files.some((file) => file.status === "failed" || file.status === "error")) {
    errors.files = "One of the files failed to process. Remove it or try another file.";
  } else if (needsFiles(config) && config.files.some((file) => file.status !== "ready")) {
    errors.files = "Wait for the pending files to finish processing.";
  }

  if (needsInstructions(config) && config.customInstructions.trim().length === 0) {
    errors.customInstructions = "Write the instructions for this quiz.";
  }

  if (needsDatabase(config) && config.databaseSource.trim().length === 0) {
    errors.databaseSource = "Select where the questions should come from.";
  }

  return errors;
}

export function isQuizReady(config: QuizConfiguration): boolean {
  return Object.keys(validateQuiz(config)).length === 0;
}