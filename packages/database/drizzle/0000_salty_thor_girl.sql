CREATE TYPE "public"."account_status" AS ENUM('pending_verification', 'active', 'locked', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."education_segment" AS ENUM('toefl', 'igcse', 'high_school', 'college');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('essential', 'analytics', 'personalization', 'marketing', 'third_party_sharing');--> statement-breakpoint
CREATE TYPE "public"."login_attempt_type" AS ENUM('oauth_login', 'token_refresh');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('pdf', 'video', 'quiz', 'exercise', 'link');--> statement-breakpoint
CREATE TYPE "public"."bundle_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_license_status" AS ENUM('active', 'expiring_soon', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."content_license_type" AS ENUM('perpetual', 'subscription', 'limited_use', 'open_source');--> statement-breakpoint
CREATE TYPE "public"."license_grant_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('telebirr');--> statement-breakpoint
CREATE TYPE "public"."purchase_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('initiated', 'payment_pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('authorization', 'capture');--> statement-breakpoint
CREATE TYPE "public"."enrollment_source" AS ENUM('purchase', 'bundle_purchase', 'free_access', 'admin_grant', 'preview');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected', 'edited');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('user_login', 'user_logout', 'purchase_completed', 'lesson_access', 'admin_action', 'data_export', 'permission_change', 'content_moderation', 'grade_modified', 'enrollment_status_changed', 'bundle_purchased');--> statement-breakpoint
CREATE TYPE "public"."audit_resource_type" AS ENUM('course', 'module', 'lesson', 'enrollment', 'quiz_attempt', 'purchase', 'user_account', 'role_assignment', 'bundle');--> statement-breakpoint
CREATE TYPE "public"."principal_type" AS ENUM('user', 'service_account', 'system');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('failed_login', 'account_lockout', 'suspicious_ip', 'token_reuse', 'rate_limit_exceeded', 'permission_denied');--> statement-breakpoint
CREATE TYPE "public"."severity_level" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('pending', 'sent', 'failed', 'retrying');--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"phone_number_encrypted" "bytea",
	"phone_number_hash" varchar(64),
	"phone_number_last4" char(4),
	"hash_version" smallint DEFAULT 1,
	"device_count" integer DEFAULT 0 NOT NULL,
	"max_devices" integer DEFAULT 3 NOT NULL,
	"display_name" varchar(100),
	"accountStatus" "account_status" DEFAULT 'active',
	"failed_login_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"deletion_completed_at" timestamp with time zone,
	"retention_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "failed_login_attempts_check" CHECK ("users"."failed_login_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"avatar_object_key" varchar(500),
	"email_encrypted" "bytea",
	"email_hash" varchar(64),
	"educationSegment" "education_segment",
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"language_preference" varchar(10) DEFAULT 'en' NOT NULL,
	"timezone" varchar(50) DEFAULT 'Africa/Addis_Ababa' NOT NULL,
	"exam_preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_profiles_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_email_hash_unique" UNIQUE("email_hash"),
	CONSTRAINT "onboarding_step_check" CHECK ("user_profiles"."onboarding_step" >= 0 AND "user_profiles"."onboarding_step" <= 5)
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"device_identifier" varchar(255) NOT NULL,
	"device_name" varchar(100),
	"platform" "device_platform",
	"os_version" varchar(50),
	"app_version" varchar(20),
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "devices_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"consentType" "consent_type",
	"consent_version" varchar(20) NOT NULL,
	"is_granted" boolean NOT NULL,
	"ip_address" "inet",
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_consents_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"phone_number_last4" char(4) NOT NULL,
	"ip_address" "inet" NOT NULL,
	"user_agent" varchar(500),
	"attemptType" "login_attempt_type",
	"is_successful" boolean NOT NULL,
	"failure_reason" varchar(100),
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "exam_types" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"parent_exam_type_id" bigint,
	"depth" smallint DEFAULT 0 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "exam_types_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "exam_types_slug_unique" UNIQUE("slug"),
	CONSTRAINT "depth_check" CHECK ("exam_types"."depth" >= 0),
	CONSTRAINT "sort_order_check" CHECK ("exam_types"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "courses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"exam_type_id" bigint NOT NULL,
	"instructor_id" bigint,
	"title" varchar(300) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"thumbnail_object_key" varchar(500),
	"price_amount" numeric(19, 4),
	"price_currency" char(3) DEFAULT 'ETB' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"status" "course_status" DEFAULT 'draft',
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "courses_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "price_check" CHECK ("courses"."price_amount" >= 0 OR "courses"."price_amount" IS NULL),
	CONSTRAINT "currency_check" CHECK ("courses"."price_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "version_check" CHECK ("courses"."version" >= 1),
	CONSTRAINT "sort_order_check" CHECK ("courses"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_stats" (
	"course_id" bigint PRIMARY KEY NOT NULL,
	"total_enrollments" integer DEFAULT 0 NOT NULL,
	"active_students_7d" integer DEFAULT 0 NOT NULL,
	"downloads_30d" integer DEFAULT 0 NOT NULL,
	"purchase_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"weighted_rating" numeric(4, 3),
	"popularity_score" numeric(10, 4),
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_check" CHECK ("course_stats"."total_enrollments" >= 0),
	CONSTRAINT "active_check" CHECK ("course_stats"."active_students_7d" >= 0),
	CONSTRAINT "downloads_check" CHECK ("course_stats"."downloads_30d" >= 0),
	CONSTRAINT "purchases_check" CHECK ("course_stats"."purchase_count" >= 0),
	CONSTRAINT "rating_check" CHECK ("course_stats"."average_rating" >= 1 AND "course_stats"."average_rating" <= 5 OR "course_stats"."average_rating" IS NULL),
	CONSTRAINT "rating_count_check" CHECK ("course_stats"."rating_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_stats_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_stats_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"course_id" bigint NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_enrollments" integer DEFAULT 0 NOT NULL,
	"active_students_7d" integer DEFAULT 0 NOT NULL,
	"downloads_30d" integer DEFAULT 0 NOT NULL,
	"purchase_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"popularity_score" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "modules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"instructor_id" bigint,
	"title" varchar(300) NOT NULL,
	"description" text,
	"sort_order" smallint NOT NULL,
	"estimated_duration_minutes" integer,
	"is_preview_available" boolean DEFAULT false NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "modules_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "sort_order_check" CHECK ("modules"."sort_order" >= 0),
	CONSTRAINT "duration_check" CHECK ("modules"."estimated_duration_minutes" > 0 OR "modules"."estimated_duration_minutes" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lessons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"module_id" bigint NOT NULL,
	"course_id" bigint NOT NULL,
	"instructor_id" bigint,
	"title" varchar(300) NOT NULL,
	"description" text,
	"contentType" "content_type",
	"file_object_key" varchar(500),
	"file_size_bytes" bigint,
	"mime_type" varchar(100),
	"duration_seconds" integer,
	"page_count" smallint,
	"is_downloadable" boolean DEFAULT true NOT NULL,
	"download_size_limit_bytes" bigint DEFAULT 524288000 NOT NULL,
	"search_vector" "tsvector",
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lessons_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "file_size_check" CHECK ("lessons"."file_size_bytes" >= 0 OR "lessons"."file_size_bytes" IS NULL),
	CONSTRAINT "duration_check" CHECK ("lessons"."duration_seconds" >= 0 OR "lessons"."duration_seconds" IS NULL),
	CONSTRAINT "page_count_check" CHECK ("lessons"."page_count" > 0 OR "lessons"."page_count" IS NULL),
	CONSTRAINT "download_limit_check" CHECK ("lessons"."download_size_limit_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "course_tags_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "course_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "course_tag_assignments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_tag_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_tag_assignments_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "course_bundles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_bundles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"exam_type_id" bigint NOT NULL,
	"instructor_id" bigint,
	"title" varchar(300) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"thumbnail_object_key" varchar(500),
	"price_amount" numeric(19, 4) NOT NULL,
	"price_currency" char(3) DEFAULT 'ETB' NOT NULL,
	"original_price_amount" numeric(19, 4) NOT NULL,
	"discount_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" "bundle_status" DEFAULT 'draft',
	"published_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "course_bundles_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "course_bundles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "price_check" CHECK ("course_bundles"."price_amount" >= 0),
	CONSTRAINT "original_price_check" CHECK ("course_bundles"."original_price_amount" >= 0),
	CONSTRAINT "discount_check" CHECK ("course_bundles"."discount_percentage" >= 0 AND "course_bundles"."discount_percentage" <= 100),
	CONSTRAINT "sort_order_check" CHECK ("course_bundles"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bundle_courses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bundle_courses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" bigint NOT NULL,
	"course_id" bigint NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_included" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_courses_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "sort_order_check" CHECK ("bundle_courses"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_licenses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_licenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" bigint NOT NULL,
	"licenseType" "content_license_type",
	"license_terms" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"auto_renewal" boolean DEFAULT false NOT NULL,
	"renewal_reminder_days" integer DEFAULT 30 NOT NULL,
	"status" "content_license_status" DEFAULT 'active',
	"grace_period_days" integer DEFAULT 90 NOT NULL,
	"licensor_name" varchar(200),
	"licensor_contact" varchar(300),
	"cost_amount" numeric(19, 4),
	"cost_currency" char(3) DEFAULT 'ETB' NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "content_licenses_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "end_date_check" CHECK ("content_licenses"."end_date" >= "content_licenses"."start_date" OR "content_licenses"."end_date" IS NULL),
	CONSTRAINT "reminder_days_check" CHECK ("content_licenses"."renewal_reminder_days" >= 0 AND "content_licenses"."renewal_reminder_days" <= 365),
	CONSTRAINT "grace_period_check" CHECK ("content_licenses"."grace_period_days" >= 0 AND "content_licenses"."grace_period_days" <= 365),
	CONSTRAINT "cost_check" CHECK ("content_licenses"."cost_amount" >= 0 OR "content_licenses"."cost_amount" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "content_license_grants" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_license_grants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"content_license_id" bigint NOT NULL,
	"student_id" bigint NOT NULL,
	"purchase_id" bigint,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"status" "license_grant_status" DEFAULT 'active',
	"revoked_at" timestamp with time zone,
	"revoke_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_license_grants_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_gateways_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"providerName" "payment_provider",
	"display_name" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"requires_disclosure" boolean DEFAULT false NOT NULL,
	"disclosure_text" text,
	"api_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "payment_gateways_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"course_id" bigint,
	"bundle_id" bigint,
	"payment_gateway_id" bigint NOT NULL,
	"platform" "purchase_platform",
	"product_id" varchar(255) NOT NULL,
	"display_name" varchar(150) NOT NULL,
	"description" text,
	"duration_days" integer NOT NULL,
	"price_amount" numeric(19, 4) NOT NULL,
	"price_currency" char(3) DEFAULT 'ETB' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "purchase_options_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "duration_check" CHECK ("purchase_options"."duration_days" > 0),
	CONSTRAINT "price_check" CHECK ("purchase_options"."price_amount" >= 0),
	CONSTRAINT "xor_constraint" CHECK (("purchase_options"."course_id" IS NOT NULL AND "purchase_options"."bundle_id" IS NULL) OR 
        ("purchase_options"."course_id" IS NULL AND "purchase_options"."bundle_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" bigint NOT NULL,
	"course_id" bigint,
	"bundle_id" bigint,
	"purchase_option_id" bigint NOT NULL,
	"payment_gateway_id" bigint NOT NULL,
	"status" "purchase_status" DEFAULT 'initiated',
	"amount" numeric(19, 4) NOT NULL,
	"currency" char(3) DEFAULT 'ETB' NOT NULL,
	"receipt_object_key" varchar(500),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "purchases_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "amount_check" CHECK ("purchases"."amount" >= 0),
	CONSTRAINT "xor_constraint" CHECK (("purchases"."course_id" IS NOT NULL AND "purchases"."bundle_id" IS NULL) OR 
        ("purchases"."course_id" IS NULL AND "purchases"."bundle_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "purchase_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" bigint NOT NULL,
	"transactionType" "transaction_type",
	"external_transaction_id" varchar(255),
	"amount" numeric(19, 4) NOT NULL,
	"currency" char(3) DEFAULT 'ETB' NOT NULL,
	"status" "transaction_status" DEFAULT 'pending',
	"validation_response" jsonb,
	"error_message" text,
	"idempotency_key" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_transactions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "purchase_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "amount_check" CHECK ("purchase_transactions"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" bigint NOT NULL,
	"course_id" bigint NOT NULL,
	"purchase_id" bigint,
	"bundle_id" bigint,
	"enrollmentSource" "enrollment_source" DEFAULT 'purchase',
	"progress_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "enrollments_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "progress_check" CHECK ("enrollments"."progress_percentage" >= 0 AND "enrollments"."progress_percentage" <= 100),
	CONSTRAINT "source_constraint" CHECK (("enrollments"."enrollmentSource" = 'bundle_purchase' AND "enrollments"."bundle_id" IS NOT NULL AND "enrollments"."purchase_id" IS NOT NULL) OR
        ("enrollments"."enrollmentSource" = 'purchase' AND "enrollments"."purchase_id" IS NOT NULL) OR
        ("enrollments"."enrollmentSource" IN ('free_access', 'admin_grant', 'preview')))
);
--> statement-breakpoint
CREATE TABLE "lesson_completions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lesson_completions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"enrollment_id" bigint NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"time_spent_seconds" integer,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_completions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "time_spent_check" CHECK ("lesson_completions"."time_spent_seconds" >= 0 OR "lesson_completions"."time_spent_seconds" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" bigint NOT NULL,
	"question_index" smallint NOT NULL,
	"question_text" text NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "quiz_questions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "question_index_check" CHECK ("quiz_questions"."question_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" bigint NOT NULL,
	"lesson_id" bigint NOT NULL,
	"attempt_number" smallint NOT NULL,
	"total_questions" smallint NOT NULL,
	"correct_answers" smallint NOT NULL,
	"quiz_score_percentage" numeric(5, 2) NOT NULL,
	"is_passed" boolean NOT NULL,
	"duration_seconds" integer,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempts_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "attempt_number_check" CHECK ("quiz_attempts"."attempt_number" >= 1),
	CONSTRAINT "total_questions_check" CHECK ("quiz_attempts"."total_questions" > 0),
	CONSTRAINT "correct_answers_check" CHECK ("quiz_attempts"."correct_answers" >= 0 AND "quiz_attempts"."correct_answers" <= "quiz_attempts"."total_questions"),
	CONSTRAINT "score_check" CHECK ("quiz_attempts"."quiz_score_percentage" >= 0 AND "quiz_attempts"."quiz_score_percentage" <= 100),
	CONSTRAINT "duration_check" CHECK ("quiz_attempts"."duration_seconds" >= 0 OR "quiz_attempts"."duration_seconds" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"quiz_attempt_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"student_answer" text,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answers_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_answer_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_answer_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"quiz_answer_id" bigint NOT NULL,
	"old_is_correct" boolean,
	"new_is_correct" boolean,
	"old_student_answer" text,
	"new_student_answer" text,
	"changed_by" bigint NOT NULL,
	"change_reason" varchar(200),
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_history_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "course_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" bigint NOT NULL,
	"course_id" bigint NOT NULL,
	"rating" smallint NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"moderationStatus" "moderation_status" DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "course_reviews_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "rating_check" CHECK ("course_reviews"."rating" >= 1 AND "course_reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" bigint,
	"actor_ip" "inet",
	"action" "audit_action",
	"resourceType" "audit_resource_type",
	"course_id" bigint,
	"module_id" bigint,
	"lesson_id" bigint,
	"enrollment_id" bigint,
	"quiz_attempt_id" bigint,
	"purchase_id" bigint,
	"bundle_id" bigint,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "principals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "principals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint,
	"principalType" "principal_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "principals_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "roles_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "course_roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "course_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"course_id" bigint,
	"role_id" bigint NOT NULL,
	"granted_by" bigint,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_roles_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "permissions_reference" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_reference_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"display_name" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_reference_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "security_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"eventType" "security_event_type",
	"actor_id" bigint,
	"actor_ip" "inet",
	"severity" "severity_level" DEFAULT 'info',
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"retention_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_events_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feature_flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"display_name" varchar(150) NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"rollout_percentage" bigint DEFAULT 0 NOT NULL,
	"allowed_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"denied_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "feature_flags_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(200) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_configs_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "system_configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"aggregate_id" varchar(255) NOT NULL,
	"event_type" varchar(200) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'pending' NOT NULL,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"max_retries" smallint DEFAULT 3 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"webhook_url" varchar(500) NOT NULL,
	"event_type" varchar(200) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_event_status" DEFAULT 'pending' NOT NULL,
	"response_status" smallint,
	"response_body" text,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"max_retries" smallint DEFAULT 3 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_limit" bigint DEFAULT 1000 NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "api_keys_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "file_metadata" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "file_metadata_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"bucket_name" varchar(100) NOT NULL,
	"original_filename" varchar(500),
	"mime_type" varchar(100),
	"file_size_bytes" bigint,
	"checksum_sha256" varchar(64),
	"encryption_key_reference" varchar(500),
	"is_public" boolean DEFAULT false NOT NULL,
	"lesson_id" bigint,
	"uploaded_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "file_metadata_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "file_metadata_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "file_size_check" CHECK ("file_metadata"."file_size_bytes" >= 0 OR "file_metadata"."file_size_bytes" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_parent_exam_type_id_exam_types_id_fk" FOREIGN KEY ("parent_exam_type_id") REFERENCES "public"."exam_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_exam_type_id_exam_types_id_fk" FOREIGN KEY ("exam_type_id") REFERENCES "public"."exam_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_stats" ADD CONSTRAINT "course_stats_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_stats_history" ADD CONSTRAINT "course_stats_history_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_tags" ADD CONSTRAINT "course_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_tag_assignments" ADD CONSTRAINT "course_tag_assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_tag_assignments" ADD CONSTRAINT "course_tag_assignments_tag_id_course_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."course_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_bundles" ADD CONSTRAINT "course_bundles_exam_type_id_exam_types_id_fk" FOREIGN KEY ("exam_type_id") REFERENCES "public"."exam_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_bundles" ADD CONSTRAINT "course_bundles_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bundle_courses" ADD CONSTRAINT "bundle_courses_bundle_id_course_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."course_bundles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bundle_courses" ADD CONSTRAINT "bundle_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "content_licenses" ADD CONSTRAINT "content_licenses_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "content_licenses" ADD CONSTRAINT "content_licenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "content_license_grants" ADD CONSTRAINT "content_license_grants_content_license_id_content_licenses_id_fk" FOREIGN KEY ("content_license_id") REFERENCES "public"."content_licenses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "content_license_grants" ADD CONSTRAINT "content_license_grants_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "content_license_grants" ADD CONSTRAINT "content_license_grants_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_options" ADD CONSTRAINT "purchase_options_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_options" ADD CONSTRAINT "purchase_options_bundle_id_course_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."course_bundles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_options" ADD CONSTRAINT "purchase_options_payment_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("payment_gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_bundle_id_course_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."course_bundles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_purchase_option_id_purchase_options_id_fk" FOREIGN KEY ("purchase_option_id") REFERENCES "public"."purchase_options"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payment_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("payment_gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_bundle_id_course_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."course_bundles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_quiz_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("quiz_attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_answer_history" ADD CONSTRAINT "quiz_answer_history_quiz_answer_id_quiz_answers_id_fk" FOREIGN KEY ("quiz_answer_id") REFERENCES "public"."quiz_answers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_answer_history" ADD CONSTRAINT "quiz_answer_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_quiz_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("quiz_attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_bundle_id_course_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."course_bundles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "principals" ADD CONSTRAINT "principals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_public_id" ON "users" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_phone_hash" ON "users" USING btree ("phone_number_hash");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("accountStatus");--> statement-breakpoint
CREATE INDEX "idx_users_deleted" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_users_deletion_sla" ON "users" USING btree ("deletion_requested_at");--> statement-breakpoint
CREATE INDEX "idx_users_retention" ON "users" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_profiles_public" ON "user_profiles" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_profiles_user" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_profiles_email_hash" ON "user_profiles" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_devices_public" ON "devices" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_devices_user_identifier" ON "devices" USING btree ("user_id","device_identifier");--> statement-breakpoint
CREATE INDEX "idx_devices_user_active" ON "devices" USING btree ("user_id","last_active_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consents_public" ON "user_consents" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_consents_user" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consents_unique" ON "user_consents" USING btree ("user_id","consentType","consent_version");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_login_attempts_public" ON "login_attempts" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_phone_time" ON "login_attempts" USING btree ("phone_number_last4","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_ip_time" ON "login_attempts" USING btree ("ip_address","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_time" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_retention" ON "login_attempts" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exam_types_public" ON "exam_types" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exam_types_slug" ON "exam_types" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_exam_types_parent_order" ON "exam_types" USING btree ("parent_exam_type_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_exam_types_active_order" ON "exam_types" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_courses_public" ON "courses" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_courses_list_query" ON "courses" USING btree ("exam_type_id","status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_courses_slug" ON "courses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_courses_instructor" ON "courses" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "idx_courses_discovery" ON "courses" USING btree ("status","is_free");--> statement-breakpoint
CREATE INDEX "idx_courses_active_list" ON "courses" USING btree ("exam_type_id","status","sort_order") WHERE "courses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_course_stats_recommendation" ON "course_stats" USING btree ("popularity_score","weighted_rating");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stats_history_course_date" ON "course_stats_history" USING btree ("course_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_stats_history_date" ON "course_stats_history" USING btree ("snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_modules_public" ON "modules" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_modules_course_order" ON "modules" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_modules_course" ON "modules" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_modules_instructor" ON "modules" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "idx_modules_course_active" ON "modules" USING btree ("course_id","sort_order") WHERE "modules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lessons_public" ON "lessons" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_module" ON "lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_course" ON "lessons" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_content_type" ON "lessons" USING btree ("contentType");--> statement-breakpoint
CREATE INDEX "idx_lessons_instructor" ON "lessons" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_search" ON "lessons" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "idx_lessons_course_type" ON "lessons" USING btree ("course_id","contentType");--> statement-breakpoint
CREATE INDEX "idx_lessons_module_active" ON "lessons" USING btree ("module_id") WHERE "lessons"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_tags_public" ON "course_tags" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_tags_slug" ON "course_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_tag_assignments_public" ON "course_tag_assignments" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_tag_assignments_unique" ON "course_tag_assignments" USING btree ("course_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_course_tag_assignments_tag" ON "course_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_course_tag_assignments_course" ON "course_tag_assignments" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_bundles_public" ON "course_bundles" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_bundles_exam_status" ON "course_bundles" USING btree ("exam_type_id","status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bundles_slug" ON "course_bundles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_bundles_instructor" ON "course_bundles" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "idx_bundles_status" ON "course_bundles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bundles_active" ON "course_bundles" USING btree ("exam_type_id","status") WHERE "course_bundles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bundle_courses_public" ON "bundle_courses" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bundle_courses_unique" ON "bundle_courses" USING btree ("bundle_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_bundle_courses_active" ON "bundle_courses" USING btree ("bundle_id","is_included","sort_order");--> statement-breakpoint
CREATE INDEX "idx_bundle_courses_course" ON "bundle_courses" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_content_licenses_public" ON "content_licenses" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_content_licenses_lesson_status" ON "content_licenses" USING btree ("lesson_id","status");--> statement-breakpoint
CREATE INDEX "idx_content_licenses_expiry_monitor" ON "content_licenses" USING btree ("end_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_content_license_grants_public" ON "content_license_grants" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_clg_student_status" ON "content_license_grants" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_clg_license_status" ON "content_license_grants" USING btree ("content_license_id","status");--> statement-breakpoint
CREATE INDEX "idx_clg_expiry" ON "content_license_grants" USING btree ("access_expires_at");--> statement-breakpoint
CREATE INDEX "idx_clg_purchase" ON "content_license_grants" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_clg_active_expiring" ON "content_license_grants" USING btree ("status","access_expires_at") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_gateways_public" ON "payment_gateways" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_gateways_provider" ON "payment_gateways" USING btree ("providerName");--> statement-breakpoint
CREATE INDEX "idx_payment_gateways_enabled" ON "payment_gateways" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_purchase_options_public" ON "purchase_options" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_options_course" ON "purchase_options" USING btree ("course_id","platform","is_active");--> statement-breakpoint
CREATE INDEX "idx_purchase_options_bundle" ON "purchase_options" USING btree ("bundle_id","platform","is_active");--> statement-breakpoint
CREATE INDEX "idx_purchase_options_gateway" ON "purchase_options" USING btree ("payment_gateway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_purchases_public" ON "purchases" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_student_time" ON "purchases" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_purchases_course" ON "purchases" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_bundle" ON "purchases" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_option" ON "purchases" USING btree ("purchase_option_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_status" ON "purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_purchases_student_course" ON "purchases" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_student_bundle" ON "purchases" USING btree ("student_id","bundle_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_status_time" ON "purchases" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_purchase_transactions_public" ON "purchase_transactions" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_transactions_purchase" ON "purchase_transactions" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_transactions_external" ON "purchase_transactions" USING btree ("external_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_purchase_transactions_idempotent" ON "purchase_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_purchase_transactions_pending" ON "purchase_transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollments_public" ON "enrollments" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollments_unique" ON "enrollments" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_student_recent" ON "enrollments" USING btree ("student_id","last_accessed_at");--> statement-breakpoint
CREATE INDEX "idx_enrollments_course_completion" ON "enrollments" USING btree ("course_id","is_completed");--> statement-breakpoint
CREATE INDEX "idx_enrollments_purchase" ON "enrollments" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_bundle" ON "enrollments" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_active" ON "enrollments" USING btree ("student_id","last_accessed_at") WHERE "enrollments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_completions_public" ON "lesson_completions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_completions_unique" ON "lesson_completions" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_completions_enrollment" ON "lesson_completions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_completions_lesson" ON "lesson_completions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_completions_progress" ON "lesson_completions" USING btree ("enrollment_id","is_completed");--> statement-breakpoint
CREATE INDEX "idx_lesson_completions_incomplete" ON "lesson_completions" USING btree ("enrollment_id","is_completed") WHERE is_completed = false;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_questions_public" ON "quiz_questions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_questions_unique" ON "quiz_questions" USING btree ("lesson_id","question_index");--> statement-breakpoint
CREATE INDEX "idx_quiz_questions_lesson" ON "quiz_questions" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_attempts_public" ON "quiz_attempts" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_student_lesson" ON "quiz_attempts" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_student_time" ON "quiz_attempts" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_lesson_pass" ON "quiz_attempts" USING btree ("lesson_id","is_passed");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_history" ON "quiz_attempts" USING btree ("student_id","lesson_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_answers_public" ON "quiz_answers" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_answers_unique" ON "quiz_answers" USING btree ("quiz_attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_answers_attempt" ON "quiz_answers" USING btree ("quiz_attempt_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_answers_question" ON "quiz_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quiz_answer_history_public" ON "quiz_answer_history" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_qah_answer_time" ON "quiz_answer_history" USING btree ("quiz_answer_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_qah_changed_by" ON "quiz_answer_history" USING btree ("changed_by","changed_at");--> statement-breakpoint
CREATE INDEX "idx_qah_time" ON "quiz_answer_history" USING btree ("changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_reviews_public" ON "course_reviews" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_course_reviews_course_rating" ON "course_reviews" USING btree ("course_id","rating");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_reviews_student_course" ON "course_reviews" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_course_reviews_status_time" ON "course_reviews" USING btree ("moderationStatus","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_audit_logs_public" ON "audit_logs" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_time" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_time" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_course" ON "audit_logs" USING btree ("resourceType","course_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_bundle" ON "audit_logs" USING btree ("resourceType","bundle_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_time" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_principals_public" ON "principals" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_principals_user" ON "principals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_principals_type" ON "principals" USING btree ("principalType");--> statement-breakpoint
CREATE INDEX "idx_principals_active" ON "principals" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_public" ON "roles" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_name" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_roles_public" ON "course_roles" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_roles_unique" ON "course_roles" USING btree ("user_id","course_id","role_id");--> statement-breakpoint
CREATE INDEX "idx_course_roles_course_role" ON "course_roles" USING btree ("course_id","role_id");--> statement-breakpoint
CREATE INDEX "idx_course_roles_role" ON "course_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_course_roles_user" ON "course_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_permissions_reference_public" ON "permissions_reference" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_permissions_reference_resource_action" ON "permissions_reference" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "idx_permissions_reference_resource" ON "permissions_reference" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_permissions_reference_active" ON "permissions_reference" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_security_events_public" ON "security_events" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_security_events_type_time" ON "security_events" USING btree ("eventType","created_at");--> statement-breakpoint
CREATE INDEX "idx_security_events_severity_time" ON "security_events" USING btree ("severity","created_at");--> statement-breakpoint
CREATE INDEX "idx_security_events_time" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_security_events_retention" ON "security_events" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feature_flags_public" ON "feature_flags" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feature_flags_key" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_enabled" ON "feature_flags" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_system_configs_public" ON "system_configs" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_system_configs_key" ON "system_configs" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_system_configs_category" ON "system_configs" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_outbox_events_public" ON "outbox_events" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_events_status_created" ON "outbox_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_events_aggregate" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_events_type" ON "outbox_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhook_events_public" ON "webhook_events" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_status_created" ON "webhook_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_type" ON "webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_next_retry" ON "webhook_events" USING btree ("next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_public" ON "api_keys" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_active" ON "api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_api_keys_expires" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_file_metadata_public" ON "file_metadata" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_file_metadata_object_key" ON "file_metadata" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_file_metadata_bucket" ON "file_metadata" USING btree ("bucket_name");--> statement-breakpoint
CREATE INDEX "idx_file_metadata_uploader_time" ON "file_metadata" USING btree ("uploaded_by","created_at");--> statement-breakpoint
CREATE INDEX "idx_file_metadata_lesson" ON "file_metadata" USING btree ("lesson_id");