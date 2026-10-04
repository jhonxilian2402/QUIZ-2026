import type { ComponentType, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type IconComponent = ComponentType<IconProps>;

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconComponent;
};

export type ConversationGroup = {
  label: string;
  items: ConversationSummary[];
};

export type ConversationSummary = {
  id: string;
  title: string;
};

export type SuggestionCardData = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export type ComposerActionId = "attach" | "image" | "search";

export type ComposerAction = {
  id: ComposerActionId;
  label: string;
  icon: IconComponent;
};

export type SelectableModel = {
  id: string;
  name: string;
  description?: string;
};

export type SelectableModelGroup = {
  label: string;
  models: SelectableModel[];
};

export type UserProfile = {
  name: string;
  plan: string;
  initials: string;
};

export type QuizContentMode = "topic" | "upload" | "topic+upload" | "instructions";

export type QuizSourceMode = "ai" | "database" | "mixed";

export type QuizDifficulty = "easy" | "medium" | "hard" | "adaptive";

export type QuizQuestionType = "multiple-choice" | "true-false" | "mixed";

export type QuizAcademicLevel =
  | "elementary"
  | "high-school"
  | "undergraduate"
  | "graduate"
  | "professional";

export type QuizLanguage = "en" | "pt-BR" | "es" | "fr" | "de";

export type QuizAiStyle = "balanced" | "conceptual" | "applied" | "exam-like";

export type QuizFileStatus = "queued" | "processing" | "ready" | "failed" | "error";

export type QuizFile = {
  id: string;
  name: string;
  size: number;
  extension: string;
  kind: "document" | "image" | "text";
  status: QuizFileStatus;
  message?: string;
};

export type QuizConfiguration = {
  subject: string;
  topic: string;
  contentMode: QuizContentMode;
  files: QuizFile[];
  source: QuizSourceMode;
  questionCount: number;
  difficulty: QuizDifficulty;
  questionType: QuizQuestionType;
  aiStyle: QuizAiStyle;
  academicLevel: QuizAcademicLevel;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number;
  language: QuizLanguage;
  explanations: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  customInstructions: string;
  databaseSource: string;
  institution: string;
  year: string;
  databaseShare: number;
};

export type QuizOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

/* ==================================================================
   Settings model
   The settings document is defined once in the shared API contracts and
   re-exported here, so the frontend and backend can never drift apart.
   Note: profile fields belong to the User entity, not to settings; they are
   served by /api/me rather than stored in this document.
   ================================================================== */

export type {
  AccentId,
  AdvancedSettings,
  AISettings,
  APISettings,
  AppearanceSettings,
  ChatSettings,
  DensityPreference,
  FilesSettings,
  FontScalePreference,
  MotionPreference,
  NotificationSettings,
  PrivacySettings,
  SearchSettings,
  ThemePreference,
  UserSettings,
} from "@/lib/api/contracts";

/** Legacy alias kept so existing component imports stay valid. */
export type QuizDefaults = import("@/lib/api/contracts").QuizDefaultsSettings;

/**
 * Every navigable settings destination. "data" is a section that hosts actions
 * rather than stored preferences, so it is not part of UserSettings.
 */
export type SettingsSectionId =
  | "profile"
  | "appearance"
  | "chat"
  | "ai"
  | "quiz"
  | "search"
  | "files"
  | "notifications"
  | "privacy"
  | "data"
  | "api"
  | "advanced";

export type EnterKeyBehavior = "send" | "newline";

export type AIResponseStyle = "concise" | "balanced" | "detailed";

export type ModelCapability = "text" | "vision" | "files" | "tools" | "web";

export type ModelTier = "free" | "paid";

export type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  tier: ModelTier;
  contextLabel: string;
  capabilities: ModelCapability[];
  available: boolean;
};

export type APIProviderStatus =
  | "not-configured"
  | "checking"
  | "connected"
  | "invalid"
  | "unavailable";