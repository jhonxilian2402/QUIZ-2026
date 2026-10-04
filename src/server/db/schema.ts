import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AttemptStatus,
  FileStatus,
  MessageMetadata,
  MessageRole,
  ProviderId,
  QuestionSource,
  QuizOptionPayload,
  QuizStatus,
  UserSettings,
  UserStatus,
} from "@/lib/api/contracts";
import type { QuizConfigurationPayload } from "@/lib/api/contracts";

/**
 * Relational schema (PostgreSQL dialect).
 *
 * Design rules applied here:
 *  - UUID primary keys so internal ids are never sequential or guessable.
 *  - Every user-owned table carries userId with a cascading foreign key.
 *  - Enums are database types, so an invalid value is rejected by the database
 *    and not merely by application code.
 *  - Indexes exist only for real access patterns (owner + recency, owner +
 *    unique key) rather than everywhere.
 *  - Timestamps are timestamptz and stored in UTC.
 */

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
] as const satisfies readonly UserStatus[]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
] as const satisfies readonly MessageRole[]);

export const quizStatusEnum = pgEnum("quiz_status", [
  "draft",
  "ready",
  "archived",
] as const satisfies readonly QuizStatus[]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "in-progress",
  "completed",
  "expired",
  "abandoned",
] as const satisfies readonly AttemptStatus[]);

export const questionSourceEnum = pgEnum("question_source", [
  "ai",
  "database",
  "web",
  "mixed",
  "file",
] as const satisfies readonly QuestionSource[]);

export const fileStatusEnum = pgEnum("file_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
  "deleted",
] as const satisfies readonly FileStatus[]);

export const providerEnum = pgEnum("provider_id", [
  "openrouter",
  "web_search",
] as const satisfies readonly ProviderId[]);

/* ------------------------------------------------------------------
   User
   ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    username: text("username"),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
  ]
);

/* ------------------------------------------------------------------
   User settings
   ------------------------------------------------------------------ */

/**
 * Settings are stored as one typed document per user with a database-level
 * default, and they are validated against a schema on every write. Splitting
 * eleven preference groups into eleven tables would add joins without adding
 * integrity, and the shape is expected to evolve; the schema is the contract.
 */
export const userSettings = pgTable(
  "user_settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    settings: jsonb("settings").$type<UserSettings>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

/* ------------------------------------------------------------------
   Sessions
   ------------------------------------------------------------------ */

/**
 * Server-side session records. The cookie carries only an opaque id; the secret
 * is hashed here, so a database leak does not yield usable sessions.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId, table.expiresAt),
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  ]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("password_reset_token_hash_unique").on(table.tokenHash)]
);

/* ------------------------------------------------------------------
   Conversations and messages
   ------------------------------------------------------------------ */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    model: text("model"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    // Primary list query: this user's conversations, most recently active first.
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<MessageMetadata | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Cursor pagination for a conversation's messages by recency.
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

/* ------------------------------------------------------------------
   Quizzes
   ------------------------------------------------------------------ */

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled quiz"),
    subject: text("subject").notNull().default(""),
    topic: text("topic").notNull().default(""),
    difficulty: text("difficulty").notNull(),
    questionType: text("question_type").notNull(),
    academicLevel: text("academic_level").notNull(),
    questionCount: integer("question_count").notNull(),
    sourceMode: questionSourceEnum("source_mode").notNull(),
    timeLimit: integer("time_limit"),
    configuration: jsonb("configuration").$type<QuizConfigurationPayload>().notNull(),
    status: quizStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quizzes_user_created_idx").on(table.userId, table.createdAt),
    index("quizzes_user_subject_idx").on(table.userId, table.subject),
  ]
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    statement: text("statement").notNull(),
    questionType: text("question_type").notNull(),
    options: jsonb("options").$type<QuizOptionPayload[]>().notNull().default([]),
    correctAnswer: text("correct_answer"),
    explanation: text("explanation"),
    source: questionSourceEnum("source").notNull().default("ai"),
    /** Only ever written by a real generator. Never fabricated. */
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown> | null>(),
    difficulty: text("difficulty"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quiz_questions_quiz_position_unique").on(
      table.quizId,
      table.position
    ),
  ]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: attemptStatusEnum("status").notNull().default("in-progress"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    score: real("score"),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    unansweredCount: integer("unanswered_count").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    /** Server-authoritative expiry: startedAt + quiz.timeLimit. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("quiz_attempts_user_created_idx").on(table.userId, table.startedAt),
    index("quiz_attempts_quiz_idx").on(table.quizId),
  ]
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    selectedAnswer: text("selected_answer"),
    /** Set by the server from the stored correct answer, never from the client. */
    isCorrect: boolean("is_correct").notNull().default(false),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quiz_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId
    ),
    index("quiz_answers_question_idx").on(table.questionId),
  ]
);

/* ------------------------------------------------------------------
   Files
   ------------------------------------------------------------------ */

export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key"),
    checksum: text("checksum"),
    status: fileStatusEnum("status").notNull().default("uploading"),
    error: text("error"),
    pageCount: integer("page_count"),
    wordCount: integer("word_count"),
    language: text("language"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("uploaded_files_user_created_idx").on(table.userId, table.createdAt)]
);

/**
 * Extracted document chunks. The database never holds the original bytes; the
 * storage provider does, while these rows carry the normalized text the AI and
 * the lexical search ground on.
 */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    page: integer("page"),
    content: text("content").notNull(),
    charCount: integer("char_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("document_chunks_file_idx").on(table.fileId),
    index("document_chunks_user_idx").on(table.userId),
  ]
);

/* ------------------------------------------------------------------
   API provider configuration
   ------------------------------------------------------------------ */

export const apiProviderConfigurations = pgTable(
  "api_provider_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    /**
     * Reference into the future credential store. The raw key is never stored
     * in this row, and never returned by any endpoint.
     */
    credentialRef: text("credential_ref"),
    defaultModel: text("default_model"),
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_provider_user_provider_unique").on(table.userId, table.provider),
  ]
);