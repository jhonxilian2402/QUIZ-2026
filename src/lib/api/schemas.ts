import { z } from "zod";
import {
  ATTEMPT_STATUSES,
  FILE_STATUSES,
  MESSAGE_ROLES,
  QUESTION_SOURCES,
  QUIZ_STATUSES,
  USER_STATUSES,
} from "./contracts";

/**
 * Shared validation schemas.
 *
 * The same schema validates on the server (security) and can be reused on the
 * client (UX), so the rules can never drift apart. Server validation is always
 * authoritative; client validation only improves feedback.
 */

/** Rejects control characters and trims, without silently altering content. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.replace(CONTROL_CHARACTERS, ""))
    .pipe(z.string().min(1).max(max));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email().max(254));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "Password is too long.");

export const uuidSchema = z.string().uuid();

/* ---------------- Auth ---------------- */

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

/* ---------------- Profile ---------------- */

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{3,32}$/, "Use 3-32 letters, numbers, dot, dash or underscore.")
      .optional(),
    bio: z.string().trim().max(160).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
  })
  .strict();

/* ---------------- Settings ---------------- */

/**
 * Full settings shape. Each section is explicit (rather than an open object),
 * so an unexpected field can never be injected into stored preferences.
 */
export const settingsSchema = z
  .object({
    appearance: z
      .object({
        theme: z.enum(["dark", "light", "system"]),
        density: z.enum(["compact", "comfortable", "spacious"]),
        motion: z.enum(["full", "reduced", "minimal"]),
        fontScale: z.enum(["small", "default", "large"]),
        accent: z.enum(["indigo", "violet", "teal", "green", "amber", "rose", "slate"]),
        reduceTransparency: z.boolean(),
        highContrast: z.boolean(),
      })
      .strict(),
    chat: z
      .object({
        defaultModelId: z.string().max(120),
        enterKeyBehavior: z.enum(["send", "newline"]),
        streaming: z.boolean(),
        autoNameConversations: z.boolean(),
        saveHistory: z.boolean(),
        messageDensity: z.enum(["compact", "comfortable", "spacious"]),
        codeRendering: z.enum(["rich", "plain"]),
        showCitations: z.boolean(),
        webResearch: z.enum(["off", "ask", "always"]),
        spellcheck: z.boolean(),
      })
      .strict(),
    ai: z
      .object({
        defaultModelId: z.string().max(120),
        fallbackModelId: z.string().max(120).nullable(),
        responseStyle: z.enum(["concise", "balanced", "detailed"]),
        creativity: z.number().int().min(0).max(100),
        maxResponseLength: z.enum(["short", "medium", "long", "provider"]),
        contextBehavior: z.enum(["retain", "summarize", "reset"]),
        reasoningEffort: z.enum(["auto", "off", "low", "medium", "high"]),
        streaming: z.boolean(),
        multimodalInput: z.boolean(),
      })
      .strict(),
    quiz: z
      .object({
        subject: z.string().max(120),
        questionCount: z.number().int().min(1).max(50),
        difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
        questionType: z.enum(["multiple-choice", "true-false", "mixed"]),
        academicLevel: z.enum([
          "elementary",
          "high-school",
          "undergraduate",
          "graduate",
          "professional",
        ]),
        source: z.enum(["ai", "database", "mixed"]),
        databaseShare: z.number().int().min(0).max(100),
        explanations: z.boolean(),
        shuffleQuestions: z.boolean(),
        shuffleAnswers: z.boolean(),
        timeLimitEnabled: z.boolean(),
        timeLimitMinutes: z.number().int().min(1).max(180),
        language: z.string().max(16),
      })
      .strict(),
    search: z
      .object({
        enabled: z.boolean(),
        provider: z.string().max(60),
        resultCount: z.number().int().min(1).max(20),
        safeSearch: z.enum(["strict", "moderate", "off"]),
        researchDepth: z.enum(["quick", "standard", "deep"]),
        citeSources: z.boolean(),
        openLinksInNewTab: z.boolean(),
      })
      .strict(),
    files: z
      .object({
        maxFileSizeMb: z.number().int().min(1).max(128),
        autoAttach: z.boolean(),
        extractText: z.boolean(),
        keepOriginal: z.boolean(),
        retention: z.enum(["session", "30-days", "until-deleted"]),
        warnOnLargeFiles: z.boolean(),
      })
      .strict(),
    notifications: z
      .object({
        quizCompleted: z.boolean(),
        generationCompleted: z.boolean(),
        errors: z.boolean(),
        accountUpdates: z.boolean(),
        productUpdates: z.boolean(),
        soundEnabled: z.boolean(),
      })
      .strict(),
    privacy: z
      .object({
        storeConversationHistory: z.boolean(),
        storeQuizHistory: z.boolean(),
        allowPersonalization: z.boolean(),
        allowAnalytics: z.boolean(),
        allowModelImprovement: z.boolean(),
        keepUploadedFiles: z.boolean(),
        keepSearchHistory: z.boolean(),
        incognitoMode: z.boolean(),
      })
      .strict(),
    api: z
      .object({
        openRouterKeyConfigured: z.boolean(),
        openRouterDefaultModelId: z.string().max(120).nullable(),
        openRouterFallbackModelId: z.string().max(120).nullable(),
        preferFreeModels: z.boolean(),
        requestTimeoutSeconds: z.number().int().min(10).max(180),
        retryOnFailure: z.boolean(),
      })
      .strict(),
    advanced: z
      .object({
        developerMode: z.boolean(),
        showDebugInfo: z.boolean(),
        verboseErrors: z.boolean(),
        experimentalQuizImport: z.boolean(),
        experimentalMultiModel: z.boolean(),
        cacheBehavior: z.enum(["default", "aggressive", "off"]),
        performanceMode: z.enum(["auto", "quality", "speed"]),
      })
      .strict(),
  })
  .strict();

/** PATCH accepts any subset, but each present section is fully validated. */
export const settingsPatchSchema = settingsSchema.partial().strict();

/* ---------------- Conversations ---------------- */

export const conversationCreateSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    model: z.string().max(120).nullable().optional(),
  })
  .strict();

export const conversationUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    model: z.string().max(120).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict();

/* ---------------- Messages ---------------- */

export const messageCreateSchema = z
  .object({
    role: z.enum(MESSAGE_ROLES).default("user"),
    content: safeText(20000),
  })
  .strict();

/* ---------------- Chat generation ---------------- */

/**
 * One chat turn: a user message plus a streamed assistant reply. The exact
 * character cap is enforced in the service from server configuration.
 */
export const chatMessageSchema = z
  .object({
    content: safeText(20000),
    /** Idempotency key: a retried send must not duplicate the turn. */
    clientRequestId: z.string().uuid().optional(),
    /** Per-request model override, verified against the catalog server-side. */
    model: z.string().max(200).nullable().optional(),
    /** Uploaded-file ids the answer should ground on. */
    attachments: z.array(uuidSchema).max(20).optional(),
  })
  .strict();

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/* ---------------- Quiz ---------------- */

export const quizCreateSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    subject: z.string().trim().max(120).default(""),
    topic: z.string().trim().max(400).default(""),
    difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
    questionType: z.enum(["multiple-choice", "true-false", "mixed"]),
    academicLevel: z.enum([
      "elementary",
      "high-school",
      "undergraduate",
      "graduate",
      "professional",
    ]),
    questionCount: z.number().int().min(1).max(50),
    sourceMode: z.enum(QUESTION_SOURCES),
    timeLimit: z.number().int().min(1).max(180).nullable().default(null),
    status: z.enum(QUIZ_STATUSES).default("draft"),
    configuration: z
      .object({
        contentMode: z.string().max(40).default("topic"),
        language: z.string().max(16).default("pt-BR"),
        explanations: z.boolean().default(true),
        shuffleQuestions: z.boolean().default(false),
        shuffleAnswers: z.boolean().default(false),
        aiStyle: z.string().max(40).default("balanced"),
        databaseShare: z.number().int().min(0).max(100).default(50),
        databaseSource: z.string().max(80).default(""),
        institution: z.string().max(120).default(""),
        year: z.string().max(40).default(""),
        academicLevel: z.string().max(40).default("high-school"),
        customInstructions: z.string().max(4000).default(""),
        fileIds: z.array(uuidSchema).max(20).optional(),
      })
      .strict(),
  })
  .strict();

export const quizUpdateSchema = quizCreateSchema.partial().strict();

/* ---------------- Attempts ---------------- */

export const attemptCreateSchema = z
  .object({
    /** Server ignores any client-provided score or correctness. */
    questionIds: z.array(uuidSchema).max(200).optional(),
  })
  .strict();

export const answerSubmitSchema = z
  .object({
    questionId: uuidSchema,
    selectedAnswer: z.string().max(500).nullable(),
    /** Idempotency key from clients that retry answer submissions. */
    clientRequestId: z.string().uuid().optional(),
  })
  .strict();

/* ---------------- Files ---------------- */

export const fileCreateSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(160),
    size: z.number().int().min(1).max(128 * 1024 * 1024),
  })
  .strict();

export const fileStatusSchema = z.enum(FILE_STATUSES);

export const fileSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    fileIds: z.array(uuidSchema).max(20).optional(),
    limit: z.number().int().min(1).max(30).default(8),
  })
  .strict();

export const fileContentQuerySchema = z
  .object({
    offset: z.coerce.number().int().min(0).optional(),
    limit: z.coerce.number().int().min(1).max(40000).optional(),
  })
  .strict();

/* ---------------- Providers ---------------- */

export const providerConfigureSchema = z
  .object({
    /** Secret value; accepted only over POST and never returned. */
    credential: z.string().min(8).max(500).optional(),
    defaultModel: z.string().max(120).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

/* ---------------- Query params ---------------- */

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(300).optional(),
  search: z.string().trim().max(200).optional(),
});

/* ---------------- AI models ---------------- */

const truthy = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const modelFiltersQuerySchema = z
  .object({
    freeOnly: truthy,
    vision: truthy,
    streaming: truthy,
    toolCalling: truthy,
    structuredOutput: truthy,
    minContext: z.coerce.number().int().min(1).max(10_000_000).optional(),
  })
  .strict();

export type ModelFiltersQuery = z.infer<typeof modelFiltersQuerySchema>;

export const userStatusSchema = z.enum(USER_STATUSES);
export const attemptStatusSchema = z.enum(ATTEMPT_STATUSES);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type ConversationUpdateInput = z.infer<typeof conversationUpdateSchema>;
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
export type QuizCreateInput = z.infer<typeof quizCreateSchema>;
export type QuizUpdateInput = z.infer<typeof quizUpdateSchema>;
export type AnswerSubmitInput = z.infer<typeof answerSubmitSchema>;
export type FileCreateInput = z.infer<typeof fileCreateSchema>;
export type FileSearchInput = z.infer<typeof fileSearchSchema>;
export type ProviderConfigureInput = z.infer<typeof providerConfigureSchema>;