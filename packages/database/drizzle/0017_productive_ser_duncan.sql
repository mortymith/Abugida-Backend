CREATE TYPE "public"."enrollment_request_state" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."waitlist_state" AS ENUM('waiting', 'promoted', 'left');--> statement-breakpoint
CREATE TYPE "public"."badge_award_source" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."badge_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."badge_trigger" AS ENUM('first_lesson', 'streak', 'quiz_perfect', 'course_completed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."rule_run_kind" AS ENUM('event', 'sweep', 'manual', 'dry_run');--> statement-breakpoint
CREATE TYPE "public"."rule_status" AS ENUM('draft', 'active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."rule_trigger" AS ENUM('course_completed', 'tag_added', 'cohort_assigned', 'account_created');--> statement-breakpoint
CREATE TYPE "public"."message_thread_kind" AS ENUM('direct', 'broadcast');--> statement-breakpoint
CREATE TABLE "cohort_members" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cohort_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" bigint NOT NULL,
	"student_id" text NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_members_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cohorts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"started_at" date,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cohorts_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "enrollment_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollment_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"course_id" bigint NOT NULL,
	"status" "enrollment_request_state" DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by" text,
	"decision_note" varchar(500),
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_requests_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "waitlist_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"student_id" text NOT NULL,
	"position" bigint NOT NULL,
	"status" "waitlist_state" DEFAULT 'waiting' NOT NULL,
	"promoted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entries_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "awarded_badges" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "awarded_badges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"badge_id" bigint NOT NULL,
	"student_id" text NOT NULL,
	"source" "badge_award_source" NOT NULL,
	"awarded_by" text,
	"note" varchar(500),
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "awarded_badges_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "badges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"icon" varchar(16),
	"triggerKind" "badge_trigger" NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify_student" boolean DEFAULT true NOT NULL,
	"status" "badge_status" DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "badges_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "issued_certificates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issued_certificates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"course_id" bigint NOT NULL,
	"enrollment_id" bigint,
	"template_id" bigint,
	"serial" varchar(40) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issued_certificates_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "enrollment_rule_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollment_rule_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" bigint NOT NULL,
	"runKind" "rule_run_kind" NOT NULL,
	"matched" bigint DEFAULT 0 NOT NULL,
	"enrolled" bigint DEFAULT 0 NOT NULL,
	"skipped" bigint DEFAULT 0 NOT NULL,
	"failed" bigint DEFAULT 0 NOT NULL,
	"details" jsonb,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ran_by" text,
	CONSTRAINT "enrollment_rule_runs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "enrollment_rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollment_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"triggerKind" "rule_trigger" NOT NULL,
	"trigger_course_id" bigint,
	"trigger_tag" varchar(60),
	"trigger_cohort_id" bigint,
	"min_quiz_avg_percent" smallint,
	"target_course_id" bigint NOT NULL,
	"send_welcome_email" boolean DEFAULT false NOT NULL,
	"status" "rule_status" DEFAULT 'draft' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "enrollment_rules_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "rule_no_self_loop" CHECK ("enrollment_rules"."trigger_course_id" IS NULL OR "enrollment_rules"."trigger_course_id" <> "enrollment_rules"."target_course_id"),
	CONSTRAINT "rule_trigger_payload" CHECK (("enrollment_rules"."triggerKind" = 'course_completed' AND "enrollment_rules"."trigger_course_id" IS NOT NULL) OR
        ("enrollment_rules"."triggerKind" = 'tag_added' AND "enrollment_rules"."trigger_tag" IS NOT NULL) OR
        ("enrollment_rules"."triggerKind" = 'cohort_assigned' AND "enrollment_rules"."trigger_cohort_id" IS NOT NULL) OR
        ("enrollment_rules"."triggerKind" = 'account_created'))
);
--> statement-breakpoint
CREATE TABLE "student_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "student_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"tag" varchar(60) NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_tags_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_threads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"staff_id" text,
	"kind" "message_thread_kind" DEFAULT 'direct' NOT NULL,
	"subject" varchar(200),
	"broadcast_group_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_preview" varchar(200),
	"unread_staff_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_threads_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" bigint NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "awarded_badges" ADD CONSTRAINT "awarded_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "awarded_badges" ADD CONSTRAINT "awarded_badges_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "awarded_badges" ADD CONSTRAINT "awarded_badges_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_template_id_certificate_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."certificate_templates"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_rule_runs" ADD CONSTRAINT "enrollment_rule_runs_rule_id_enrollment_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."enrollment_rules"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_rule_runs" ADD CONSTRAINT "enrollment_rule_runs_ran_by_users_id_fk" FOREIGN KEY ("ran_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_rules" ADD CONSTRAINT "enrollment_rules_trigger_course_id_courses_id_fk" FOREIGN KEY ("trigger_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_rules" ADD CONSTRAINT "enrollment_rules_trigger_cohort_id_cohorts_id_fk" FOREIGN KEY ("trigger_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_rules" ADD CONSTRAINT "enrollment_rules_target_course_id_courses_id_fk" FOREIGN KEY ("target_course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_rules" ADD CONSTRAINT "enrollment_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "student_tags" ADD CONSTRAINT "student_tags_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "student_tags" ADD CONSTRAINT "student_tags_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cohort_members_unique" ON "cohort_members" USING btree ("cohort_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_cohort_members_student" ON "cohort_members" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cohorts_public" ON "cohorts" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_cohorts_name" ON "cohorts" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_requests_public" ON "enrollment_requests" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_requests_open_unique" ON "enrollment_requests" USING btree ("student_id","course_id") WHERE "enrollment_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_enrollment_requests_status" ON "enrollment_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_enrollment_requests_course" ON "enrollment_requests" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlist_entries_public" ON "waitlist_entries" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlist_entries_waiting_unique" ON "waitlist_entries" USING btree ("course_id","student_id") WHERE "waitlist_entries"."status" = 'waiting';--> statement-breakpoint
CREATE INDEX "idx_waitlist_entries_queue" ON "waitlist_entries" USING btree ("course_id","status","position");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_awarded_badges_public" ON "awarded_badges" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_awarded_badges_unique" ON "awarded_badges" USING btree ("badge_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_awarded_badges_student" ON "awarded_badges" USING btree ("student_id","awarded_at");--> statement-breakpoint
CREATE INDEX "idx_awarded_badges_badge" ON "awarded_badges" USING btree ("badge_id","awarded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_badges_public" ON "badges" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_badges_status" ON "badges" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_badges_unique_name" ON "badges" USING btree ("name") WHERE "badges"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issued_certificates_public" ON "issued_certificates" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issued_certificates_serial" ON "issued_certificates" USING btree ("serial");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issued_certificates_unique" ON "issued_certificates" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_issued_certificates_student" ON "issued_certificates" USING btree ("student_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_rule_runs_public" ON "enrollment_rule_runs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_enrollment_rule_runs_rule" ON "enrollment_rule_runs" USING btree ("rule_id","ran_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_rules_public" ON "enrollment_rules" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_enrollment_rules_status" ON "enrollment_rules" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_student_tags_public" ON "student_tags" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_student_tags_unique" ON "student_tags" USING btree ("student_id","tag");--> statement-breakpoint
CREATE INDEX "idx_student_tags_tag" ON "student_tags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_threads_public" ON "message_threads" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_message_threads_staff_recent" ON "message_threads" USING btree ("staff_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_message_threads_student" ON "message_threads" USING btree ("student_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_message_threads_broadcast" ON "message_threads" USING btree ("broadcast_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messages_public" ON "messages" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_messages_thread_recent" ON "messages" USING btree ("thread_id","created_at");