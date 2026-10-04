/**
 * Shared API contracts.
 *
 * These types are the single source of truth for the boundary between the
 * frontend and the server. Both sides import from here, so a response shape
 * cannot drift between the API and its client.
 */

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "DATABASE_ERROR",
  "INTERNAL_ERROR",
  /* AI provider errors (normalized; raw provider detail never reaches clients) */
  "AI_PROVIDER_UNAVAILABLE",
  "AI_AUTHENTICATION_FAILED",
  "AI_MODEL_UNAVAILABLE",
  "AI_RATE_LIMITED",
  "AI_REQUEST_TIMEOUT",
  "AI_INVALID_REQUEST",
  "AI_CONTENT_ERROR",
  "AI_CONTEXT_TOO_LARGE",
  "AI_UNKNOWN_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level validation detail, keyed by field path. */
    details?: Record<string, string[]>;
    /** Safe correlation id, never a stack trace. */
    requestId?: string;
  };
};

export type ApiSuccessBody<T> = {
  data: T;
};

export type ApiResult<T> = ApiSuccessBody<T>;

/** Cursor page shape used by every list endpoint. */
export type Page<T> = {
  items: T[];
  /** Opaque cursor for the next page, or null at the end of the list. */
  nextCursor: string | null;
};

/* ------------------------------------------------------------------
   Domain enums (mirrored by database enums so values cannot diverge)
   ------------------------------------------------------------------ */

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const QUIZ_STATUSES = ["draft", "ready", "archived"] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

export const ATTEMPT_STATUSES = ["in-progress", "completed", "expired", "abandoned"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const FILE_STATUSES = [
  "uploading",
  "processing",
  "ready",
  "failed",
  "deleted",
] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const QUESTION_SOURCES = ["ai", "database", "web", "mixed", "file"] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

export const PROVIDER_IDS = ["openrouter", "web_search"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/* ------------------------------------------------------------------
   Resource DTOs (never raw database rows)
   ------------------------------------------------------------------ */

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  status: UserStatus;
};

export type UserResponse = SessionUser & {
  bio: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
  /** Present only when authenticated; safe, non-secret session metadata. */
  session: { expiresAt: string } | null;
};

export type ConversationResponse = {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type MessageResponse = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  /** Provider/token/citation metadata. Null until a provider exists. */
  metadata: MessageMetadata | null;
  createdAt: string;
};

export type MessageMetadata = {
  /** The model that actually produced the content. */
  model?: string;
  /** The model the caller asked for; differs after a fallback. */
  requestedModel?: string;
  provider?: string;
  /** True when Part 6 fallback logic served the request with another model. */
  fallbackUsed?: boolean;
  tokens?: { prompt: number; completion: number } | null;
  /** Lifecycle of an assistant turn. Absent means a normal stored message. */
  status?: "completed" | "failed" | "cancelled";
  /** True when content is incomplete because generation stopped early. */
  partial?: boolean;
  durationMs?: number;
  /** Idempotency key of the send that created this message. */
  clientRequestId?: string;
  citations?: { title: string; url: string }[];
  /** Uploaded file references this turn grounded on. */
  attachments?: string[];
  /** File-provenance citations returned by the model's own content. */
  fileCitations?: Array<{ fileId: string; filename: string; page: number | null }>;
  toolCalls?: string[];
};

export type QuizResponse = {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  questionType: string;
  academicLevel: string;
  questionCount: number;
  sourceMode: QuestionSource;
  timeLimit: number | null;
  configuration: QuizConfigurationPayload;
  status: QuizStatus;
  createdAt: string;
  updatedAt: string;
  /** Real counts from the database; omitted from create responses. */
  questionTotal?: number;
  latestAttempt?: { score: number | null; status: AttemptStatus; completedAt: string | null } | null;
};

export type QuizConfigurationPayload = {
  contentMode: string;
  language: string;
  explanations: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  aiStyle: string;
  databaseShare: number;
  databaseSource: string;
  institution: string;
  year: string;
  academicLevel: string;
  customInstructions: string;
  /** File ids from /api/files the generation must be grounded in. */
  fileIds?: string[];
};

export type QuizQuestionResponse = {
  id: string;
  quizId: string;
  position: number;
  statement: string;
  questionType: string;
  options: QuizOptionPayload[];
  /** Omitted from the client payload while an attempt is in progress. */
  correctAnswer?: string | null;
  explanation: string | null;
  source: QuestionSource;
  sourceMetadata: Record<string, unknown> | null;
  difficulty: string | null;
};

export type QuizOptionPayload = {
  id: string;
  label: string;
};

/** Honest report of how a quiz's questions were produced. */
export type QuizGenerationInfo = {
  connected: boolean;
  reason?: string;
  model?: string | null;
  requestedModel?: string | null;
  fallbackUsed?: boolean;
  durationMs?: number;
};

export type QuizAttemptResponse = {
  id: string;
  quizId: string;
  status: AttemptStatus;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  durationSeconds: number | null;
  /** Server-authoritative deadline; null when the quiz is untimed. */
  expiresAt: string | null;
};

export type QuizAnswerResponse = {
  id: string;
  attemptId: string;
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  answeredAt: string;
};

export type UploadedFileResponse = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string | null;
  status: FileStatus;
  error: string | null;
  pageCount: number | null;
  wordCount: number | null;
  language: string | null;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderResponse = {
  provider: ProviderId;
  /** Never the credential itself. */
  configured: boolean;
  enabled: boolean;
  defaultModel: string | null;
  updatedAt: string | null;
};

export type HealthResponse = {
  status: "ok";
  /** Whether the database answered a trivial query. */
  database: "ok" | "unavailable";
};

/* ------------------------------------------------------------------
   AI model catalog (normalized; raw provider payloads never leave the server)
   ------------------------------------------------------------------ */

/**
 * Normalized capability flags. `false` means "not reported by the provider":
 * the application never invents support a model did not declare.
 */
export type AIModelCapabilities = {
  text: boolean;
  vision: boolean;
  imageInput: boolean;
  fileInput: boolean;
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
};

export type AIModelResponse = {
  id: string;
  provider: "openrouter";
  name: string;
  description: string | null;
  /** Null when the provider does not report one; never fabricated. */
  contextLength: number | null;
  capabilities: AIModelCapabilities;
  /** USD per token. Null when the provider does not report pricing. */
  pricing: {
    input: number | null;
    output: number | null;
  };
  /** Derived from current provider pricing, never from the model's name. */
  isFree: boolean;
  isAvailable: boolean;
};

export type AIModelCatalogResponse = {
  models: AIModelResponse[];
  /** When the catalog was last fetched from the provider. */
  updatedAt: string;
  /** True when a refresh failed and a previous catalog is being served. */
  stale: boolean;
};

export type AIProviderStatusResponse = {
  provider: "openrouter";
  /** Whether a platform API key exists in server configuration. */
  configured: boolean;
  /** Whether the last provider contact succeeded. Null when never attempted. */
  reachable: boolean | null;
  modelCount: number | null;
  freeModelCount: number | null;
  catalogUpdatedAt: string | null;
  catalogStale: boolean | null;
};

/* ------------------------------------------------------------------
   Chat streaming contract (Server-Sent Events)
   One event per SSE frame: `event: <type>` + `data: <json>`.
   ------------------------------------------------------------------ */

export type ChatStreamUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type ChatStreamEvent =
  | {
      type: "start";
      conversationId: string;
      userMessage: MessageResponse;
      model: string;
      requestedModel: string;
      fallbackUsed: boolean;
    }
  | { type: "delta"; content: string }
  | { type: "usage"; usage: ChatStreamUsage }
  | {
      type: "complete";
      conversation: ConversationResponse;
      assistantMessage: MessageResponse;
    }
  | {
      type: "error";
      code: ErrorCode;
      message: string;
      /** The user message is preserved; generation failed or was cancelled. */
      userMessage: MessageResponse | null;
      /** A partial assistant message exists when generation produced output. */
      assistantMessage: MessageResponse | null;
    };

/* ------------------------------------------------------------------
   Request payloads
   ------------------------------------------------------------------ */

export type PaginationQuery = {
  limit?: number;
  cursor?: string | null;
  search?: string;
};

/* ------------------------------------------------------------------
   Stored settings document
   ------------------------------------------------------------------ */

export type AccentId =
  | "indigo"
  | "violet"
  | "teal"
  | "green"
  | "amber"
  | "rose"
  | "slate";

export type ThemePreference = "dark" | "light" | "system";
export type DensityPreference = "compact" | "comfortable" | "spacious";
export type MotionPreference = "full" | "reduced" | "minimal";
export type FontScalePreference = "small" | "default" | "large";

export type AppearanceSettings = {
  theme: ThemePreference;
  density: DensityPreference;
  motion: MotionPreference;
  fontScale: FontScalePreference;
  accent: AccentId;
  reduceTransparency: boolean;
  highContrast: boolean;
};

export type ChatSettings = {
  defaultModelId: string;
  enterKeyBehavior: "send" | "newline";
  streaming: boolean;
  autoNameConversations: boolean;
  saveHistory: boolean;
  messageDensity: DensityPreference;
  codeRendering: "rich" | "plain";
  showCitations: boolean;
  webResearch: "off" | "ask" | "always";
  spellcheck: boolean;
};

export type AISettings = {
  defaultModelId: string;
  fallbackModelId: string | null;
  responseStyle: "concise" | "balanced" | "detailed";
  creativity: number;
  maxResponseLength: "short" | "medium" | "long" | "provider";
  contextBehavior: "retain" | "summarize" | "reset";
  reasoningEffort: "auto" | "off" | "low" | "medium" | "high";
  streaming: boolean;
  multimodalInput: boolean;
};

export type QuizDefaultsSettings = {
  subject: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard" | "adaptive";
  questionType: "multiple-choice" | "true-false" | "mixed";
  academicLevel:
    | "elementary"
    | "high-school"
    | "undergraduate"
    | "graduate"
    | "professional";
  source: "ai" | "database" | "mixed";
  databaseShare: number;
  explanations: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number;
  language: string;
};

export type SearchSettings = {
  enabled: boolean;
  provider: string;
  resultCount: number;
  safeSearch: "strict" | "moderate" | "off";
  researchDepth: "quick" | "standard" | "deep";
  citeSources: boolean;
  openLinksInNewTab: boolean;
};

export type FilesSettings = {
  maxFileSizeMb: number;
  autoAttach: boolean;
  extractText: boolean;
  keepOriginal: boolean;
  retention: "session" | "30-days" | "until-deleted";
  warnOnLargeFiles: boolean;
};

export type NotificationSettings = {
  quizCompleted: boolean;
  generationCompleted: boolean;
  errors: boolean;
  accountUpdates: boolean;
  productUpdates: boolean;
  soundEnabled: boolean;
};

export type PrivacySettings = {
  storeConversationHistory: boolean;
  storeQuizHistory: boolean;
  allowPersonalization: boolean;
  allowAnalytics: boolean;
  allowModelImprovement: boolean;
  keepUploadedFiles: boolean;
  keepSearchHistory: boolean;
  incognitoMode: boolean;
};

export type APISettings = {
  openRouterKeyConfigured: boolean;
  openRouterDefaultModelId: string | null;
  openRouterFallbackModelId: string | null;
  preferFreeModels: boolean;
  requestTimeoutSeconds: number;
  retryOnFailure: boolean;
};

export type AdvancedSettings = {
  developerMode: boolean;
  showDebugInfo: boolean;
  verboseErrors: boolean;
  experimentalQuizImport: boolean;
  experimentalMultiModel: boolean;
  cacheBehavior: "default" | "aggressive" | "off";
  performanceMode: "auto" | "quality" | "speed";
};

export type UserSettings = {
  appearance: AppearanceSettings;
  chat: ChatSettings;
  ai: AISettings;
  quiz: QuizDefaultsSettings;
  search: SearchSettings;
  files: FilesSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  api: APISettings;
  advanced: AdvancedSettings;
};