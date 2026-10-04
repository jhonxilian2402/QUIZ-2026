import type {
  AccentId,
  DensityPreference,
  FontScalePreference,
  MotionPreference,
  QuizOption,
  SettingsSectionId,
  ThemePreference,
  UserSettings,
} from "@/types";

/**
 * Centralized default settings. This is the single source of truth for every
 * value in the application; components never inline their own defaults. A
 * future backend can deep-merge a user record over this object.
 */
export const DEFAULT_SETTINGS: UserSettings = {
  appearance: {
    theme: "dark",
    density: "comfortable",
    motion: "full",
    fontScale: "default",
    accent: "indigo",
    reduceTransparency: false,
    highContrast: false,
  },
  chat: {
    // Empty means "automatic": the backend resolves a compatible live model.
    defaultModelId: "",
    enterKeyBehavior: "send",
    streaming: true,
    autoNameConversations: true,
    saveHistory: true,
    messageDensity: "comfortable",
    codeRendering: "rich",
    showCitations: true,
    webResearch: "off",
    spellcheck: false,
  },
  ai: {
    // Empty means "automatic": the backend resolves a compatible live model.
    defaultModelId: "",
    fallbackModelId: null,
    responseStyle: "balanced",
    creativity: 40,
    maxResponseLength: "provider",
    contextBehavior: "retain",
    reasoningEffort: "auto",
    streaming: true,
    multimodalInput: true,
  },
  quiz: {
    subject: "",
    questionCount: 10,
    difficulty: "medium",
    questionType: "multiple-choice",
    academicLevel: "high-school",
    source: "ai",
    databaseShare: 50,
    explanations: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    timeLimitEnabled: false,
    timeLimitMinutes: 15,
    language: "pt-BR",
  },
  search: {
    enabled: false,
    provider: "",
    resultCount: 5,
    safeSearch: "moderate",
    researchDepth: "standard",
    citeSources: true,
    openLinksInNewTab: true,
  },
  files: {
    maxFileSizeMb: 24,
    autoAttach: true,
    extractText: true,
    keepOriginal: true,
    retention: "until-deleted",
    warnOnLargeFiles: true,
  },
  notifications: {
    quizCompleted: true,
    generationCompleted: true,
    errors: true,
    accountUpdates: true,
    productUpdates: false,
    soundEnabled: false,
  },
  privacy: {
    storeConversationHistory: true,
    storeQuizHistory: true,
    allowPersonalization: true,
    allowAnalytics: false,
    allowModelImprovement: false,
    keepUploadedFiles: true,
    keepSearchHistory: false,
    incognitoMode: false,
  },
  api: {
    openRouterKeyConfigured: false,
    openRouterDefaultModelId: null,
    openRouterFallbackModelId: null,
    preferFreeModels: true,
    requestTimeoutSeconds: 60,
    retryOnFailure: true,
  },
  advanced: {
    developerMode: false,
    showDebugInfo: false,
    verboseErrors: false,
    experimentalQuizImport: false,
    experimentalMultiModel: false,
    cacheBehavior: "default",
    performanceMode: "auto",
  },
};

/* ------------------------------------------------------------------
   Option catalogues
   ------------------------------------------------------------------ */

export const THEME_OPTIONS: QuizOption<ThemePreference>[] = [
  {
    value: "dark",
    label: "Dark",
    description: "Primary appearance of the workspace.",
  },
  { value: "light", label: "Light", description: "Re-tuned light palette." },
  {
    value: "system",
    label: "System",
    description: "Follow the operating system preference.",
  },
];

export const DENSITY_OPTIONS: QuizOption<DensityPreference>[] = [
  { value: "compact", label: "Compact", description: "Tighter spacing." },
  { value: "comfortable", label: "Comfortable", description: "Reference spacing." },
  { value: "spacious", label: "Spacious", description: "Roomier spacing." },
];

export const MOTION_OPTIONS: QuizOption<MotionPreference>[] = [
  { value: "full", label: "Full", description: "All transitions." },
  { value: "reduced", label: "Reduced", description: "Shorter transitions." },
  { value: "minimal", label: "Minimal", description: "No transitions." },
];

export const FONT_SCALE_OPTIONS: QuizOption<FontScalePreference>[] = [
  { value: "small", label: "Small" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
];

export const ACCENT_OPTIONS: {
  value: AccentId;
  label: string;
  hex: string;
}[] = [
  { value: "indigo", label: "Indigo", hex: "#7f9dff" },
  { value: "violet", label: "Violet", hex: "#a48cf5" },
  { value: "teal", label: "Teal", hex: "#58c2bb" },
  { value: "green", label: "Green", hex: "#6ec79a" },
  { value: "amber", label: "Amber", hex: "#d6ab5c" },
  { value: "rose", label: "Rose", hex: "#e58ba0" },
  { value: "slate", label: "Slate", hex: "#9aa6bd" },
];

export const SETTINGS_SECTIONS: {
  id: SettingsSectionId;
  label: string;
  group: string;
}[] = [
  { id: "profile", label: "Profile", group: "Account" },
  { id: "appearance", label: "Appearance", group: "Workspace" },
  { id: "chat", label: "Chat", group: "Workspace" },
  { id: "ai", label: "AI & Models", group: "Workspace" },
  { id: "quiz", label: "Quiz defaults", group: "Workspace" },
  { id: "search", label: "Search", group: "Capabilities" },
  { id: "files", label: "Files", group: "Capabilities" },
  { id: "notifications", label: "Notifications", group: "Capabilities" },
  { id: "privacy", label: "Privacy", group: "Data" },
  { id: "data", label: "Data management", group: "Data" },
  { id: "api", label: "API providers", group: "Connections" },
  { id: "advanced", label: "Advanced", group: "Connections" },
];