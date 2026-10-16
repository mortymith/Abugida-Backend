CREATE TYPE "public"."lesson_body_revision_reason" AS ENUM('save', 'ai_accept', 'restore', 'migration');--> statement-breakpoint
CREATE TABLE "lessons_body_revisions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lessons_body_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" bigint NOT NULL,
	"body" text NOT NULL,
	"body_format" "lesson_body_format" NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" "lesson_body_revision_reason" NOT NULL,
	CONSTRAINT "lessons_body_revisions_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "lessons_body_revisions" ADD CONSTRAINT "lessons_body_revisions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;