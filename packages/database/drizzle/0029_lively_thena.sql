CREATE TYPE "public"."upload_checkpoint_status" AS ENUM('active', 'paused', 'completed', 'aborted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."transcription_job_kind" AS ENUM('full', 'range');--> statement-breakpoint
CREATE TYPE "public"."transcription_job_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "asset_upload_checkpoints" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_upload_checkpoints_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_draft_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"multipart_upload_id" varchar(500),
	"total_bytes" bigint NOT NULL,
	"uploaded_bytes" bigint DEFAULT 0 NOT NULL,
	"last_chunk_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "upload_checkpoint_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_upload_checkpoints_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "transcription_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transcription_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" bigint NOT NULL,
	"transcript_id" bigint,
	"language" varchar(10) NOT NULL,
	"kind" "transcription_job_kind" DEFAULT 'full' NOT NULL,
	"range_start_ms" integer,
	"range_end_ms" integer,
	"status" "transcription_job_status" DEFAULT 'queued' NOT NULL,
	"provider" varchar(100),
	"error" text,
	"result_summary" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "transcription_jobs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "asset_folders" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_library" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_library" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD COLUMN "edited_by" text;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_upload_checkpoints" ADD CONSTRAINT "asset_upload_checkpoints_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_upload_checkpoints" ADD CONSTRAINT "asset_upload_checkpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_asset_id_asset_library_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_library"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_upload_checkpoints_public" ON "asset_upload_checkpoints" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_upload_checkpoints_draft" ON "asset_upload_checkpoints" USING btree ("asset_draft_id");--> statement-breakpoint
CREATE INDEX "idx_asset_upload_checkpoints_org_status" ON "asset_upload_checkpoints" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_asset_upload_checkpoints_creator" ON "asset_upload_checkpoints" USING btree ("created_by","status");--> statement-breakpoint
CREATE INDEX "idx_asset_upload_checkpoints_purge" ON "asset_upload_checkpoints" USING btree ("last_chunk_at") WHERE "asset_upload_checkpoints"."status" IN ('active', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transcription_jobs_public" ON "transcription_jobs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_asset" ON "transcription_jobs" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_status" ON "transcription_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_transcript" ON "transcription_jobs" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_creator" ON "transcription_jobs" USING btree ("created_by","status");--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_asset_library_archived" ON "asset_library" USING btree ("organization_id","archived_at") WHERE "asset_library"."deleted_at" IS NULL AND "asset_library"."archived_at" IS NOT NULL;