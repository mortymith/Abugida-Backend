CREATE TYPE "public"."lesson_body_format" AS ENUM('html', 'markdown');--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "bodyFormat" "lesson_body_format" DEFAULT 'html' NOT NULL;