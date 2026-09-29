CREATE TYPE "public"."course_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."course_pricing_model" AS ENUM('free', 'one_time', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."course_type" AS ENUM('self_paced', 'instructor_led', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."lesson_review_status" AS ENUM('draft', 'in_review', 'changes_requested', 'approved');--> statement-breakpoint
CREATE TYPE "public"."lock_behavior" AS ENUM('hidden', 'visible_locked');--> statement-breakpoint
CREATE TYPE "public"."unlock_condition" AS ENUM('viewed', 'completed', 'quiz_score');--> statement-breakpoint
CREATE TYPE "public"."discount_kind" AS ENUM('early_bird', 'bulk');--> statement-breakpoint
CREATE TYPE "public"."session_provider" AS ENUM('zoom', 'google_meet', 'custom');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."completion_rule_kind" AS ENUM('all_lessons', 'min_percent_quiz');--> statement-breakpoint
CREATE TYPE "public"."quiz_question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('pending', 'changes_requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_job_kind" AS ENUM('course_outline', 'quiz_draft');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('completed', 'undone', 'failed');--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quizzes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"title" varchar(300) NOT NULL,
	"passing_score_percent" smallint DEFAULT 70 NOT NULL,
	"time_limit_minutes" integer,
	"max_attempts" smallint,
	"is_published" boolean DEFAULT false NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "quizzes_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "passing_score_check" CHECK ("quizzes"."passing_score_percent" BETWEEN 1 AND 100),
	CONSTRAINT "time_limit_check" CHECK ("quizzes"."time_limit_minutes" > 0 OR "quizzes"."time_limit_minutes" IS NULL),
	CONSTRAINT "max_attempts_check" CHECK ("quizzes"."max_attempts" > 0 OR "quizzes"."max_attempts" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "quiz_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"question_id" bigint NOT NULL,
	"option_index" smallint NOT NULL,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "quiz_options_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "option_index_check" CHECK ("quiz_options"."option_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_unlock_rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lesson_unlock_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"required_lesson_id" bigint NOT NULL,
	"condition" "unlock_condition" DEFAULT 'viewed' NOT NULL,
	"threshold_percent" smallint,
	"lockBehavior" "lock_behavior" DEFAULT 'visible_locked' NOT NULL,
	"custom_message" text,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_unlock_rules_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "threshold_check" CHECK ("lesson_unlock_rules"."threshold_percent" BETWEEN 1 AND 100 OR "lesson_unlock_rules"."threshold_percent" IS NULL),
	CONSTRAINT "no_self_reference" CHECK ("lesson_unlock_rules"."lesson_id" <> "lesson_unlock_rules"."required_lesson_id")
);
--> statement-breakpoint
CREATE TABLE "course_discounts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_discounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"kind" "discount_kind" NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"ends_at" timestamp with time zone,
	"min_enrollments" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_discounts_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "percentage_check" CHECK ("course_discounts"."percentage" > 0 AND "course_discounts"."percentage" <= 99),
	CONSTRAINT "min_enrollments_check" CHECK ("course_discounts"."min_enrollments" > 0 OR "course_discounts"."min_enrollments" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "course_templates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"structure" jsonb NOT NULL,
	"module_count" smallint DEFAULT 0 NOT NULL,
	"lesson_count" smallint DEFAULT 0 NOT NULL,
	"quiz_count" smallint DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "course_templates_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "course_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "live_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"host_id" text,
	"provider" "session_provider" DEFAULT 'custom' NOT NULL,
	"join_url" varchar(500),
	"auto_record" boolean DEFAULT false NOT NULL,
	"recording_lesson_id" bigint,
	"reminder_24h" boolean DEFAULT true NOT NULL,
	"reminder_1h" boolean DEFAULT true NOT NULL,
	"attendee_count" integer DEFAULT 0 NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "live_sessions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "attendee_count_check" CHECK ("live_sessions"."attendee_count" >= 0),
	CONSTRAINT "duration_check" CHECK ("live_sessions"."duration_minutes" > 0 OR "live_sessions"."duration_minutes" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "completion_rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "completion_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"rule" "completion_rule_kind" DEFAULT 'all_lessons' NOT NULL,
	"min_percent" smallint DEFAULT 80 NOT NULL,
	"auto_issue" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "completion_rules_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "completion_rules_course_id_unique" UNIQUE("course_id"),
	CONSTRAINT "min_percent_check" CHECK ("completion_rules"."min_percent" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "certificate_templates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "certificate_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"title" varchar(200) NOT NULL,
	"show_student_name" boolean DEFAULT true NOT NULL,
	"show_course_title" boolean DEFAULT true NOT NULL,
	"show_completion_date" boolean DEFAULT true NOT NULL,
	"show_signature" boolean DEFAULT true NOT NULL,
	"signature_object_key" varchar(500),
	"signature_label" varchar(150),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_templates_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "certificate_templates_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"requested_by" text NOT NULL,
	"decided_by" text,
	"state" "review_state" DEFAULT 'pending' NOT NULL,
	"submission_note" text,
	"decision_comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_requests_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "ai_generation_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_generation_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ai_job_kind" NOT NULL,
	"status" "ai_job_status" DEFAULT 'completed' NOT NULL,
	"prompt" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"provider" text DEFAULT 'local' NOT NULL,
	"tokens_used" integer,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_generation_jobs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint,
	"file_name" varchar(300) NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "import_job_status" DEFAULT 'completed' NOT NULL,
	"error" text,
	"undo_expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_jobs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "pricingModel" "course_pricing_model";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "courseType" "course_type" DEFAULT 'self_paced';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "level" "course_level";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "enrollment_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "enrollment_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "scheduled_publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_url" varchar(500);--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "sort_order" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "reviewStatus" "lesson_review_status" DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "questionType" "quiz_question_type";--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "points" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_unlock_rules" ADD CONSTRAINT "lesson_unlock_rules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_unlock_rules" ADD CONSTRAINT "lesson_unlock_rules_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_unlock_rules" ADD CONSTRAINT "lesson_unlock_rules_required_lesson_id_lessons_id_fk" FOREIGN KEY ("required_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_discounts" ADD CONSTRAINT "course_discounts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_recording_lesson_id_lessons_id_fk" FOREIGN KEY ("recording_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "completion_rules" ADD CONSTRAINT "completion_rules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_generation_jobs" ADD CONSTRAINT "ai_generation_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quizzes_public" ON "quizzes" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quizzes_lesson" ON "quizzes" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_quizzes_course" ON "quizzes" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_options_public" ON "quiz_options" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_options_order" ON "quiz_options" USING btree ("question_id","option_index");--> statement-breakpoint
CREATE INDEX "idx_quiz_options_question" ON "quiz_options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_unlock_rules_public" ON "lesson_unlock_rules" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_unlock_rules_unique" ON "lesson_unlock_rules" USING btree ("lesson_id","required_lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_unlock_rules_lesson" ON "lesson_unlock_rules" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_unlock_rules_course" ON "lesson_unlock_rules" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_discounts_public" ON "course_discounts" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_discounts_unique" ON "course_discounts" USING btree ("course_id","kind");--> statement-breakpoint
CREATE INDEX "idx_course_discounts_course" ON "course_discounts" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_templates_public" ON "course_templates" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_templates_slug" ON "course_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_course_templates_category" ON "course_templates" USING btree ("category","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_live_sessions_public" ON "live_sessions" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_live_sessions_course_time" ON "live_sessions" USING btree ("course_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_live_sessions_host_time" ON "live_sessions" USING btree ("host_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_live_sessions_status" ON "live_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_completion_rules_public" ON "completion_rules" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_certificate_templates_public" ON "certificate_templates" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_certificate_templates_course" ON "certificate_templates" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_review_requests_public" ON "review_requests" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_review_requests_state" ON "review_requests" USING btree ("state","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_review_requests_course" ON "review_requests" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_review_requests_lesson" ON "review_requests" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_review_requests_requested_by" ON "review_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ai_generation_jobs_public" ON "ai_generation_jobs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_ai_generation_jobs_kind_status" ON "ai_generation_jobs" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "idx_ai_generation_jobs_created_by" ON "ai_generation_jobs" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_import_jobs_public" ON "import_jobs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_course" ON "import_jobs" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_created_by" ON "import_jobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_lessons_review_status" ON "lessons" USING btree ("course_id","reviewStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lessons_module_order" ON "lessons" USING btree ("module_id","sort_order");