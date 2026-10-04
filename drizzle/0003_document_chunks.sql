ALTER TYPE "public"."question_source" ADD VALUE 'file';--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "word_count" integer;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "language" text;--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"page" integer,
	"content" text NOT NULL,
	"char_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_file_idx" ON "document_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "document_chunks_user_idx" ON "document_chunks" USING btree ("user_id");
