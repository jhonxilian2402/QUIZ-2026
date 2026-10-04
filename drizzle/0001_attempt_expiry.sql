ALTER TYPE "public"."attempt_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "expires_at" timestamp with time zone;
