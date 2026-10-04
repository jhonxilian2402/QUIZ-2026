// AUTO-GENERATED — do not edit by hand.
// Source: drizzle/*.sql. Regenerate with: node scripts/generate-migrations.mjs
//
// Applied by src/server/db/client.ts through a ledger table so each migration
// runs exactly once per database, mirroring how a real PostgreSQL deployment
// applies the same files.

export type Migration = {
  name: string;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    name: "0000_init",
    statements: [
      "CREATE TYPE \"public\".\"attempt_status\" AS ENUM('in-progress', 'completed', 'abandoned');",
      "CREATE TYPE \"public\".\"file_status\" AS ENUM('uploading', 'processing', 'ready', 'failed', 'deleted');",
      "CREATE TYPE \"public\".\"message_role\" AS ENUM('user', 'assistant', 'system');",
      "CREATE TYPE \"public\".\"provider_id\" AS ENUM('openrouter', 'web_search');",
      "CREATE TYPE \"public\".\"question_source\" AS ENUM('ai', 'database', 'web', 'mixed');",
      "CREATE TYPE \"public\".\"quiz_status\" AS ENUM('draft', 'ready', 'archived');",
      "CREATE TYPE \"public\".\"user_status\" AS ENUM('active', 'suspended', 'deleted');",
      "CREATE TABLE \"api_provider_configurations\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"provider\" \"provider_id\" NOT NULL,\n\t\"credential_ref\" text,\n\t\"default_model\" text,\n\t\"enabled\" boolean DEFAULT false NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"conversations\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"title\" text DEFAULT 'New conversation' NOT NULL,\n\t\"model\" text,\n\t\"metadata\" jsonb,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"archived_at\" timestamp with time zone\n);",
      "CREATE TABLE \"messages\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"conversation_id\" uuid NOT NULL,\n\t\"role\" \"message_role\" NOT NULL,\n\t\"content\" text NOT NULL,\n\t\"metadata\" jsonb,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"password_reset_tokens\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"token_hash\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"used_at\" timestamp with time zone\n);",
      "CREATE TABLE \"quiz_answers\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"attempt_id\" uuid NOT NULL,\n\t\"question_id\" uuid NOT NULL,\n\t\"selected_answer\" text,\n\t\"is_correct\" boolean DEFAULT false NOT NULL,\n\t\"answered_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"quiz_attempts\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"quiz_id\" uuid NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"status\" \"attempt_status\" DEFAULT 'in-progress' NOT NULL,\n\t\"started_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"completed_at\" timestamp with time zone,\n\t\"score\" real,\n\t\"correct_count\" integer DEFAULT 0 NOT NULL,\n\t\"incorrect_count\" integer DEFAULT 0 NOT NULL,\n\t\"unanswered_count\" integer DEFAULT 0 NOT NULL,\n\t\"duration_seconds\" integer\n);",
      "CREATE TABLE \"quiz_questions\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"quiz_id\" uuid NOT NULL,\n\t\"position\" integer NOT NULL,\n\t\"statement\" text NOT NULL,\n\t\"question_type\" text NOT NULL,\n\t\"options\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"correct_answer\" text,\n\t\"explanation\" text,\n\t\"source\" \"question_source\" DEFAULT 'ai' NOT NULL,\n\t\"source_metadata\" jsonb,\n\t\"difficulty\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"quizzes\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"title\" text DEFAULT 'Untitled quiz' NOT NULL,\n\t\"subject\" text DEFAULT '' NOT NULL,\n\t\"topic\" text DEFAULT '' NOT NULL,\n\t\"difficulty\" text NOT NULL,\n\t\"question_type\" text NOT NULL,\n\t\"academic_level\" text NOT NULL,\n\t\"question_count\" integer NOT NULL,\n\t\"source_mode\" \"question_source\" NOT NULL,\n\t\"time_limit\" integer,\n\t\"configuration\" jsonb NOT NULL,\n\t\"status\" \"quiz_status\" DEFAULT 'draft' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"sessions\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"token_hash\" text NOT NULL,\n\t\"user_agent\" text,\n\t\"ip_hash\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"revoked_at\" timestamp with time zone\n);",
      "CREATE TABLE \"uploaded_files\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"filename\" text NOT NULL,\n\t\"mime_type\" text NOT NULL,\n\t\"size\" integer NOT NULL,\n\t\"storage_key\" text,\n\t\"checksum\" text,\n\t\"status\" \"file_status\" DEFAULT 'uploading' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"user_settings\" (\n\t\"user_id\" uuid PRIMARY KEY NOT NULL,\n\t\"settings\" jsonb NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"users\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"email\" text NOT NULL,\n\t\"password_hash\" text NOT NULL,\n\t\"display_name\" text NOT NULL,\n\t\"username\" text,\n\t\"bio\" text DEFAULT '' NOT NULL,\n\t\"avatar_url\" text,\n\t\"status\" \"user_status\" DEFAULT 'active' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_login_at\" timestamp with time zone\n);",
      "ALTER TABLE \"api_provider_configurations\" ADD CONSTRAINT \"api_provider_configurations_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"conversations\" ADD CONSTRAINT \"conversations_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"messages\" ADD CONSTRAINT \"messages_conversation_id_conversations_id_fk\" FOREIGN KEY (\"conversation_id\") REFERENCES \"public\".\"conversations\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"password_reset_tokens\" ADD CONSTRAINT \"password_reset_tokens_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"quiz_answers\" ADD CONSTRAINT \"quiz_answers_attempt_id_quiz_attempts_id_fk\" FOREIGN KEY (\"attempt_id\") REFERENCES \"public\".\"quiz_attempts\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"quiz_answers\" ADD CONSTRAINT \"quiz_answers_question_id_quiz_questions_id_fk\" FOREIGN KEY (\"question_id\") REFERENCES \"public\".\"quiz_questions\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"quiz_attempts\" ADD CONSTRAINT \"quiz_attempts_quiz_id_quizzes_id_fk\" FOREIGN KEY (\"quiz_id\") REFERENCES \"public\".\"quizzes\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"quiz_attempts\" ADD CONSTRAINT \"quiz_attempts_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"quiz_questions\" ADD CONSTRAINT \"quiz_questions_quiz_id_quizzes_id_fk\" FOREIGN KEY (\"quiz_id\") REFERENCES \"public\".\"quizzes\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"quizzes\" ADD CONSTRAINT \"quizzes_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"sessions\" ADD CONSTRAINT \"sessions_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"uploaded_files\" ADD CONSTRAINT \"uploaded_files_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"user_settings\" ADD CONSTRAINT \"user_settings_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE UNIQUE INDEX \"api_provider_user_provider_unique\" ON \"api_provider_configurations\" USING btree (\"user_id\",\"provider\");",
      "CREATE INDEX \"conversations_user_updated_idx\" ON \"conversations\" USING btree (\"user_id\",\"updated_at\");",
      "CREATE INDEX \"messages_conversation_created_idx\" ON \"messages\" USING btree (\"conversation_id\",\"created_at\");",
      "CREATE UNIQUE INDEX \"password_reset_token_hash_unique\" ON \"password_reset_tokens\" USING btree (\"token_hash\");",
      "CREATE UNIQUE INDEX \"quiz_answers_attempt_question_unique\" ON \"quiz_answers\" USING btree (\"attempt_id\",\"question_id\");",
      "CREATE INDEX \"quiz_attempts_user_created_idx\" ON \"quiz_attempts\" USING btree (\"user_id\",\"started_at\");",
      "CREATE INDEX \"quiz_attempts_quiz_idx\" ON \"quiz_attempts\" USING btree (\"quiz_id\");",
      "CREATE UNIQUE INDEX \"quiz_questions_quiz_position_unique\" ON \"quiz_questions\" USING btree (\"quiz_id\",\"position\");",
      "CREATE INDEX \"quizzes_user_created_idx\" ON \"quizzes\" USING btree (\"user_id\",\"created_at\");",
      "CREATE INDEX \"quizzes_user_subject_idx\" ON \"quizzes\" USING btree (\"user_id\",\"subject\");",
      "CREATE INDEX \"sessions_user_idx\" ON \"sessions\" USING btree (\"user_id\",\"expires_at\");",
      "CREATE UNIQUE INDEX \"sessions_token_hash_unique\" ON \"sessions\" USING btree (\"token_hash\");",
      "CREATE INDEX \"uploaded_files_user_created_idx\" ON \"uploaded_files\" USING btree (\"user_id\",\"created_at\");",
      "CREATE UNIQUE INDEX \"users_email_unique\" ON \"users\" USING btree (\"email\");",
      "CREATE UNIQUE INDEX \"users_username_unique\" ON \"users\" USING btree (\"username\");",
    ],
  },
  {
    name: "0001_attempt_expiry",
    statements: [
      "ALTER TYPE \"public\".\"attempt_status\" ADD VALUE 'expired';",
      "ALTER TABLE \"quiz_attempts\" ADD COLUMN \"expires_at\" timestamp with time zone;",
    ],
  },
  {
    name: "0002_quiz_answer_question_idx",
    statements: [
      "CREATE INDEX \"quiz_answers_question_idx\" ON \"quiz_answers\" USING btree (\"question_id\");",
    ],
  },
  {
    name: "0003_document_chunks",
    statements: [
      "ALTER TYPE \"public\".\"question_source\" ADD VALUE 'file';",
      "ALTER TABLE \"uploaded_files\" ADD COLUMN \"error\" text;",
      "ALTER TABLE \"uploaded_files\" ADD COLUMN \"page_count\" integer;",
      "ALTER TABLE \"uploaded_files\" ADD COLUMN \"word_count\" integer;",
      "ALTER TABLE \"uploaded_files\" ADD COLUMN \"language\" text;",
      "CREATE TABLE \"document_chunks\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"file_id\" uuid NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"position\" integer NOT NULL,\n\t\"page\" integer,\n\t\"content\" text NOT NULL,\n\t\"char_count\" integer NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"document_chunks\" ADD CONSTRAINT \"document_chunks_file_id_uploaded_files_id_fk\" FOREIGN KEY (\"file_id\") REFERENCES \"public\".\"uploaded_files\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"document_chunks\" ADD CONSTRAINT \"document_chunks_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"document_chunks_file_idx\" ON \"document_chunks\" USING btree (\"file_id\");",
      "CREATE INDEX \"document_chunks_user_idx\" ON \"document_chunks\" USING btree (\"user_id\");",
    ],
  },
];

/** Ledger table recording which migrations a database has already applied. */
export const MIGRATION_LEDGER_TABLE = "__migrations";
