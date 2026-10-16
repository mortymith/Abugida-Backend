CREATE TYPE "public"."lesson_language" AS ENUM('en', 'am', 'ti', 'gez');--> statement-breakpoint
CREATE TYPE "public"."lesson_variant_language" AS ENUM('en', 'am', 'ti', 'gez');--> statement-breakpoint
CREATE TYPE "public"."attendance_source" AS ENUM('provider', 'manual');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'absent');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'enrolled', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "lesson_variants" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lesson_variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" bigint NOT NULL,
	"language" "lesson_variant_language" NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text,
	"body_format" "lesson_body_format" DEFAULT 'markdown' NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_variants_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "course_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"actor_id" text NOT NULL,
	"body_snapshot" jsonb NOT NULL,
	"readiness_snapshot" jsonb NOT NULL,
	"item_deltas" jsonb DEFAULT '{"added":0,"removed":0,"modified":0,"items":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_versions_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_settings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_gateway_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"gateway_id" bigint NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_gateway_settings_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_attendance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"session_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"status" "attendance_status" NOT NULL,
	"source" "attendance_source" DEFAULT 'manual' NOT NULL,
	"marked_by" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_attendance_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "waitlists" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "waitlists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"offered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlists_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "waitlists_offered_has_expires" CHECK (("waitlists"."status" = 'offered' AND "waitlists"."offered_at" IS NOT NULL AND "waitlists"."expires_at" IS NOT NULL) OR "waitlists"."status" <> 'offered'),
	CONSTRAINT "waitlists_enrolled_has_enrolled_at" CHECK (("waitlists"."status" = 'enrolled' AND "waitlists"."enrolled_at" IS NOT NULL) OR "waitlists"."status" <> 'enrolled')
);
--> statement-breakpoint
CREATE TABLE "review_annotations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_annotations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"review_request_id" bigint NOT NULL,
	"selector" text NOT NULL,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_annotations_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "language" "lesson_language";--> statement-breakpoint
ALTER TABLE "lesson_variants" ADD CONSTRAINT "lesson_variants_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_variants" ADD CONSTRAINT "lesson_variants_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_versions" ADD CONSTRAINT "course_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_versions" ADD CONSTRAINT "course_versions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_gateway_settings" ADD CONSTRAINT "payment_gateway_settings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_gateway_settings" ADD CONSTRAINT "payment_gateway_settings_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_annotations" ADD CONSTRAINT "review_annotations_review_request_id_review_requests_id_fk" FOREIGN KEY ("review_request_id") REFERENCES "public"."review_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_annotations" ADD CONSTRAINT "review_annotations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "review_annotations" ADD CONSTRAINT "review_annotations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_variants_public" ON "lesson_variants" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_variants_lesson_lang" ON "lesson_variants" USING btree ("lesson_id","language");--> statement-breakpoint
CREATE INDEX "idx_lesson_variants_lesson" ON "lesson_variants" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_variants_language" ON "lesson_variants" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_versions_public" ON "course_versions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_versions_course_version" ON "course_versions" USING btree ("course_id","version");--> statement-breakpoint
CREATE INDEX "idx_course_versions_course" ON "course_versions" USING btree ("course_id","version");--> statement-breakpoint
CREATE INDEX "idx_course_versions_actor" ON "course_versions" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_gateway_settings_public" ON "payment_gateway_settings" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_gateway_settings_course_gateway" ON "payment_gateway_settings" USING btree ("course_id","gateway_id");--> statement-breakpoint
CREATE INDEX "idx_payment_gateway_settings_course" ON "payment_gateway_settings" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_payment_gateway_settings_gateway" ON "payment_gateway_settings" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "idx_payment_gateway_settings_enabled" ON "payment_gateway_settings" USING btree ("course_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_session_attendance_public" ON "session_attendance" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_session_attendance_session_user" ON "session_attendance" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_session_attendance_session" ON "session_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_attendance_user" ON "session_attendance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_attendance_status" ON "session_attendance" USING btree ("session_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlists_public" ON "waitlists" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlists_course_user_active" ON "waitlists" USING btree ("course_id","user_id","status");--> statement-breakpoint
CREATE INDEX "idx_waitlists_course" ON "waitlists" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_waitlists_user" ON "waitlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_waitlists_status" ON "waitlists" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "idx_waitlists_offered_expires" ON "waitlists" USING btree ("expires_at") WHERE "waitlists"."status" = 'offered';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_review_annotations_public" ON "review_annotations" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_review_annotations_request" ON "review_annotations" USING btree ("review_request_id");--> statement-breakpoint
CREATE INDEX "idx_review_annotations_author" ON "review_annotations" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_review_annotations_open" ON "review_annotations" USING btree ("review_request_id") WHERE "review_annotations"."resolved_at" IS NULL;