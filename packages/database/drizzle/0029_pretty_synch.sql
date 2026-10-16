CREATE TYPE "public"."export_format" AS ENUM('csv', 'xlsx', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."export_job_status" AS ENUM('generating', 'queued', 'ready', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."export_report_type" AS ENUM('course_performance', 'student_progress', 'quiz_analytics', 'revenue_report', 'cohort_comparison', 'funnel');--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "export_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"reportType" "export_report_type" NOT NULL,
	"format" "export_format" NOT NULL,
	"course_ids" text[] DEFAULT '{}' NOT NULL,
	"range_start" timestamp with time zone NOT NULL,
	"range_end" timestamp with time zone NOT NULL,
	"include_aggregated_charts" text DEFAULT 'false' NOT NULL,
	"include_student_level_data" text DEFAULT 'false' NOT NULL,
	"lesson_id" text,
	"cohort_ids" text[] DEFAULT '{}',
	"status" "export_job_status" DEFAULT 'queued' NOT NULL,
	"row_estimate" bigint,
	"file_size_bytes" bigint,
	"storage_key" varchar(500),
	"expires_at" timestamp with time zone,
	"error_message" text,
	"request_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "export_jobs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_export_jobs_public" ON "export_jobs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_export_jobs_user_status" ON "export_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_export_jobs_org_status" ON "export_jobs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_export_jobs_ready" ON "export_jobs" USING btree ("expires_at") WHERE "export_jobs"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "idx_export_jobs_expiry_sweep" ON "export_jobs" USING btree ("expires_at") WHERE "export_jobs"."status" = 'ready' AND "export_jobs"."expires_at" IS NOT NULL;