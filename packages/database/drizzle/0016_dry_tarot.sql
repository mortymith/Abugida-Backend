CREATE TYPE "public"."asset_category" AS ENUM('video', 'image', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."transcript_source" AS ENUM('manual', 'imported', 'stt', 'translated');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('draft', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "asset_folders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_folders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"parent_id" bigint,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "asset_folders_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "asset_library" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_library_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" "asset_category" DEFAULT 'other' NOT NULL,
	"folder_id" bigint,
	"current_version" integer DEFAULT 1 NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"file_size_bytes" bigint,
	"mime_type" varchar(100),
	"duration_seconds" integer,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "asset_library_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "asset_size_check" CHECK ("asset_library"."file_size_bytes" >= 0 OR "asset_library"."file_size_bytes" IS NULL),
	CONSTRAINT "asset_duration_check" CHECK ("asset_library"."duration_seconds" >= 0 OR "asset_library"."duration_seconds" IS NULL),
	CONSTRAINT "asset_version_check" CHECK ("asset_library"."current_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "asset_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" bigint NOT NULL,
	"version_number" integer NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"file_size_bytes" bigint,
	"mime_type" varchar(100),
	"duration_seconds" integer,
	"note" varchar(300),
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_versions_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "asset_usage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_usage_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "transcript_segments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transcript_segments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"transcript_id" bigint NOT NULL,
	"segment_index" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"speaker" varchar(80),
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_segments_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "segment_time_check" CHECK ("transcript_segments"."end_ms" > "transcript_segments"."start_ms"),
	CONSTRAINT "segment_start_check" CHECK ("transcript_segments"."start_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transcripts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" bigint NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"status" "transcript_status" DEFAULT 'draft' NOT NULL,
	"show_by_default" boolean DEFAULT true NOT NULL,
	"caption_style" jsonb,
	"source" "transcript_source" DEFAULT 'manual' NOT NULL,
	"translated_from_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcripts_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "asset_id" bigint;--> statement-breakpoint
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_parent_id_asset_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."asset_folders"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_library" ADD CONSTRAINT "asset_library_folder_id_asset_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."asset_folders"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_library" ADD CONSTRAINT "asset_library_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_asset_id_asset_library_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_library"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_usage" ADD CONSTRAINT "asset_usage_asset_id_asset_library_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_library"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_usage" ADD CONSTRAINT "asset_usage_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_usage" ADD CONSTRAINT "asset_usage_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_asset_id_asset_library_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_library"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_translated_from_id_transcripts_id_fk" FOREIGN KEY ("translated_from_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_folders_public" ON "asset_folders" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_asset_folders_parent" ON "asset_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_asset_folders_active" ON "asset_folders" USING btree ("parent_id","name") WHERE "asset_folders"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_library_public" ON "asset_library" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_asset_library_folder" ON "asset_library" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "idx_asset_library_category" ON "asset_library" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_asset_library_uploaded_by" ON "asset_library" USING btree ("uploaded_by","created_at");--> statement-breakpoint
CREATE INDEX "idx_asset_library_name" ON "asset_library" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_asset_library_active_list" ON "asset_library" USING btree ("folder_id","created_at") WHERE "asset_library"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_versions_public" ON "asset_versions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_versions_asset_number" ON "asset_versions" USING btree ("asset_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_asset_versions_asset" ON "asset_versions" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_usage_public" ON "asset_usage" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_usage_asset_lesson" ON "asset_usage" USING btree ("asset_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_asset_usage_lesson" ON "asset_usage" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transcript_segments_public" ON "transcript_segments" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transcript_segments_order" ON "transcript_segments" USING btree ("transcript_id","segment_index");--> statement-breakpoint
CREATE INDEX "idx_transcript_segments_transcript" ON "transcript_segments" USING btree ("transcript_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transcripts_public" ON "transcripts" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transcripts_asset_language" ON "transcripts" USING btree ("asset_id","language");--> statement-breakpoint
CREATE INDEX "idx_transcripts_asset_status" ON "transcripts" USING btree ("asset_id","status");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_asset_id_asset_library_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_library"("id") ON DELETE set null ON UPDATE cascade;