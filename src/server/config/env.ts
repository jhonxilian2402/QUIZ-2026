import { z } from "zod";

/**
 * Environment configuration.
 *
 * Validation runs once when the server module is first imported. A missing or
 * malformed required variable fails fast with a clear message that names the
 * variable — never its value — so misconfiguration cannot silently continue.
 *
 * This module is server-only. Nothing here may be imported into a component
 * that ships to the browser.
 */

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_URL: z.string().url().default("http://localhost:4311"),

  /** Database connection. PGlite uses this as a filesystem directory. */
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_DIR: z.string().min(1).optional(),

  /** Signs session cookies and reset tokens. Required outside tests. */
  AUTH_SECRET: z.string().min(32).optional(),

  /**
   * OpenRouter platform key. Server-only: it must never appear in a public
   * variable, a client bundle, a log line or an API response.
   */
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  /** Attribution headers documented by OpenRouter; both optional. */
  OPENROUTER_APP_NAME: z.string().min(1).max(80).optional(),
  /** Generation timeout. Streaming and catalog use derived values. */
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
  /** Extra attempts after the first for transient failures only. */
  OPENROUTER_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  /** How long the normalized model catalog is served before revalidation. */
  AI_MODEL_CACHE_TTL_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .max(24 * 60 * 60_000)
    .default(3_600_000),
  /** Preferred platform model; validated against the live catalog before use. */
  AI_DEFAULT_MODEL: z.string().min(1).max(200).optional(),
  /** Hard server-side cap for a single chat message, in characters. */
  AI_MAX_MESSAGE_LENGTH: z.coerce.number().int().min(100).max(100_000).default(8000),
  /** Minimum quiz size the builder and API will accept. */
  QUIZ_MIN_QUESTIONS: z.coerce.number().int().min(1).max(100).default(1),
  /** Maximum quiz size; the builder and API reject anything larger. */
  QUIZ_MAX_QUESTIONS: z.coerce.number().int().min(1).max(100).default(50),
  /** Wall-clock budget for one AI quiz generation call. */
  QUIZ_GENERATION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(300_000)
    .default(120_000),
  /** Recovery passes when the AI output fails validation. */
  QUIZ_GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  /** Real question-bank API used for "database"-sourced questions. */
  QUESTION_DB_BASE_URL: z.string().url().default("https://opentdb.com"),
  /** Real source consulted for "web"-sourced quizzes. */
  WEB_RESEARCH_BASE_URL: z.string().url().default("https://en.wikipedia.org"),
  /** Wall-clock budget for one external question-source request. */
  QUESTION_SOURCE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(2_000)
    .max(60_000)
    .default(15_000),
  /** Approximate token budget for conversation context sent to the model. */
  AI_CONTEXT_TOKEN_BUDGET: z.coerce
    .number()
    .int()
    .min(500)
    .max(200_000)
    .default(24_000),

  STORAGE_URL: z.string().url().optional(),
  /** Local directory for stored file bytes (STORAGE_DIR under project root). */
  STORAGE_DIR: z.string().default(".data/storage"),
  /** Hard cap for one uploaded file decoded to text (bytes). */
  FILE_MAX_SIZE_MB: z.coerce.number().int().min(1).max(256).default(24),
  /** Chunk sizing for document chunking. */
  FILE_CHUNK_SIZE: z.coerce.number().int().min(500).max(4000).default(1600),
  FILE_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(800).default(200),
  /** Guardrails for zip-based formats (docx/pptx). */
  FILE_MAX_ARCHIVE_MB: z.coerce.number().int().min(8).max(256).default(48),
  /** Guardrail for zip entry counts (zip-bomb defense). */
  FILE_MAX_ARCHIVE_ENTRIES: z.coerce.number().int().min(10).max(100_000).default(5000),
  /** OCR is optional; the processor reports it as a limitation when off. */
  OCR_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** Decompression-bomb guard for images: maximum pixel count before OCR. */
  FILE_MAX_IMAGE_PIXELS: z.coerce
    .number()
    .int()
    .min(100_000)
    .max(200_000_000)
    .default(20_000_000),
  /** Wall-clock budget for one processing run. */
  FILE_PROCESSING_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(600_000)
    .default(120_000),
  API_URL: z.string().url().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  RATE_LIMIT_DISABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof baseSchema> & {
  databaseLocation: string;
  authSecret: string;
  isProduction: boolean;
};

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const name = issue.path.join(".") || "(root)";
      return `  - ${name}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * Parses and validates the environment. Throws a single, readable error listing
 * every problem at once rather than failing on the first one.
 */
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env
): ServerEnv {
  const parsed = baseSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration. Fix the following and restart:\n${formatIssues(
        parsed.error
      )}`
    );
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";
  const isTest = env.NODE_ENV === "test";

  // AUTH_SECRET is required everywhere except local test runs, where a fixed
  // development value is used so tests are reproducible.
  if (!env.AUTH_SECRET && !isTest) {
    throw new Error(
      "Invalid environment configuration. Fix the following and restart:\n" +
        "  - AUTH_SECRET: required (min 32 characters). Generate one with `openssl rand -base64 48`."
    );
  }

  const databaseLocation =
    env.DATABASE_DIR ?? env.DATABASE_URL ?? ".data/pglite";

  return {
    ...env,
    databaseLocation,
    authSecret:
      env.AUTH_SECRET ??
      "test-only-secret-value-not-used-in-production-0000000000",
    isProduction,
  };
}

let cached: ServerEnv | null = null;

/** Lazily validated singleton, so importing modules never re-parses. */
export function getEnv(): ServerEnv {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Test helper: replaces the cached env for the current process. */
export function setEnvForTesting(env: ServerEnv): void {
  cached = env;
}