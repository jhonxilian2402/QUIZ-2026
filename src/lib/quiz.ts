import type {
  QuizAcademicLevel,
  QuizAiStyle,
  QuizConfiguration,
  QuizContentMode,
  QuizDifficulty,
  QuizLanguage,
  QuizOption,
  QuizQuestionType,
  QuizSourceMode,
} from "@/types";

/**
 * Predefined subject list. It is a plain data array so the selector can be
 * swapped to a database or configuration feed without touching components.
 */
export const QUIZ_SUBJECTS: string[] = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Portuguese",
  "Literature",
  "History",
  "Geography",
  "English",
  "Computer Science",
  "Philosophy",
  "Sociology",
];

export const CONTENT_MODE_OPTIONS: QuizOption<QuizContentMode>[] = [
  {
    value: "topic",
    label: "Topic only",
    description: "Generate from a subject and topic alone.",
  },
  {
    value: "upload",
    label: "Upload material",
    description: "Generate strictly from uploaded material.",
  },
  {
    value: "topic+upload",
    label: "Topic + material",
    description: "Combine a topic with uploaded material.",
  },
  {
    value: "instructions",
    label: "Custom instructions",
    description: "Describe exactly what the quiz should cover.",
  },
];

export const SOURCE_MODE_OPTIONS: QuizOption<QuizSourceMode>[] = [
  {
    value: "ai",
    label: "AI Generated",
    description: "Questions written by the model for this configuration.",
  },
  {
    value: "database",
    label: "Question Database / Web Research",
    description: "Questions retrieved from indexed sources.",
  },
  {
    value: "mixed",
    label: "AI + Database Mixed",
    description: "Compose the set from retrieved and generated questions.",
  },
];

export const DIFFICULTY_OPTIONS: QuizOption<QuizDifficulty>[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "adaptive", label: "Adaptive" },
];

export const QUESTION_TYPE_OPTIONS: QuizOption<QuizQuestionType>[] = [
  { value: "multiple-choice", label: "Multiple choice" },
  { value: "true-false", label: "True / False" },
  { value: "mixed", label: "Mixed" },
];

export const ACADEMIC_LEVEL_OPTIONS: QuizOption<QuizAcademicLevel>[] = [
  { value: "elementary", label: "Elementary" },
  { value: "high-school", label: "High school" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "professional", label: "Professional" },
];

export const AI_STYLE_OPTIONS: QuizOption<QuizAiStyle>[] = [
  { value: "balanced", label: "Balanced", description: "Mixed recall and reasoning." },
  { value: "conceptual", label: "Conceptual", description: "Definitions and understanding." },
  { value: "applied", label: "Applied", description: "Problem solving and cases." },
  { value: "exam-like", label: "Exam-like", description: "Formal exam phrasing." },
];

export const TIME_LIMIT_OPTIONS: QuizOption<string>[] = [
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
];

export const LANGUAGE_OPTIONS: QuizOption<QuizLanguage>[] = [
  { value: "pt-BR", label: "Portuguese (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

export const QUESTION_COUNT_MIN = 1;
export const QUESTION_COUNT_MAX = 50;

export const DEFAULT_QUIZ_CONFIGURATION: QuizConfiguration = {
  subject: "",
  topic: "",
  contentMode: "topic",
  files: [],
  source: "ai",
  questionCount: 10,
  difficulty: "medium",
  questionType: "multiple-choice",
  aiStyle: "balanced",
  academicLevel: "high-school",
  timeLimitEnabled: false,
  timeLimitMinutes: 15,
  language: "pt-BR",
  explanations: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
  customInstructions: "",
  databaseSource: "",
  institution: "",
  year: "",
  databaseShare: 50,
};

export const DATABASE_SOURCE_OPTIONS: QuizOption<string>[] = [
  { value: "public-exams", label: "Public exams" },
  { value: "university", label: "University entrance" },
  { value: "textbook", label: "Textbook bank" },
  { value: "open-web", label: "Open web research" },
];

export const FILE_ACCEPT =
  ".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp";

export const MAX_FILE_SIZE = 24 * 1024 * 1024;

const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const TEXT_EXTENSIONS = ["txt", "md"];

export const SUPPORTED_FORMATS_LABEL = "PDF, TXT, MD, DOC, DOCX, PPT, PPTX, PNG, JPG, WEBP";

export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function getFileKind(
  extension: string
): "document" | "image" | "text" | null {
  if (DOCUMENT_EXTENSIONS.includes(extension)) return "document";
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (TEXT_EXTENSIONS.includes(extension)) return "text";
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBytes(bytes: number): string {
  return formatFileSize(bytes);
}

export function createQuizFile(
  name: string,
  size: number,
  index: number
): { file: import("@/types").QuizFile | null; error?: string } {
  const extension = getFileExtension(name);
  const kind = getFileKind(extension);
  const id = `file-${Date.now()}-${index}`;

  if (!kind) {
    return {
      file: null,
      error: `${name} is not a supported format.`,
    };
  }

  return {
    file: {
      id,
      name,
      size,
      extension,
      kind,
      status: "queued",
    },
  };
}