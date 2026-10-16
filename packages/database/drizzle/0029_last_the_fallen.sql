CREATE TYPE "public"."enrollment_denial_reason" AS ENUM('course_full', 'prerequisites_not_met', 'duplicate_request', 'not_eligible', 'other');--> statement-breakpoint
CREATE TYPE "public"."enrollment_invite_status" AS ENUM('pending', 'claimed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_delivery_channel" AS ENUM('in_app', 'telegram', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_delivery_state" AS ENUM('pending', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TABLE "enrollment_invites" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollment_invites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" bigint NOT NULL,
	"cohort_id" bigint,
	"token_hash" varchar(64) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"status" "enrollment_invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_invites_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"message_id" bigint NOT NULL,
	"thread_id" bigint NOT NULL,
	"recipient_id" text NOT NULL,
	"channel" "message_delivery_channel" NOT NULL,
	"state" "message_delivery_state" DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failure_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_deliveries_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_handle" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD COLUMN "decision_reason" "enrollment_denial_reason";--> statement-breakpoint
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_invites_public" ON "enrollment_invites" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_invites_token" ON "enrollment_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_invites_code" ON "enrollment_invites" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "idx_enrollment_invites_org_status" ON "enrollment_invites" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_enrollment_invites_course" ON "enrollment_invites" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "idx_enrollment_invites_creator" ON "enrollment_invites" USING btree ("created_by","status");--> statement-breakpoint
CREATE INDEX "idx_enrollment_invites_expiry_sweep" ON "enrollment_invites" USING btree ("expires_at") WHERE "enrollment_invites"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_deliveries_public" ON "message_deliveries" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_deliveries_message_recipient_channel" ON "message_deliveries" USING btree ("message_id","recipient_id","channel");--> statement-breakpoint
CREATE INDEX "idx_message_deliveries_message" ON "message_deliveries" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_deliveries_recipient" ON "message_deliveries" USING btree ("recipient_id","state");--> statement-breakpoint
CREATE INDEX "idx_message_deliveries_thread" ON "message_deliveries" USING btree ("thread_id","state");--> statement-breakpoint
CREATE INDEX "idx_message_deliveries_pending" ON "message_deliveries" USING btree ("created_at") WHERE "message_deliveries"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_users_archived" ON "users" USING btree ("account_status","archived_at") WHERE "users"."deleted_at" IS NULL AND "users"."archived_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_telegram" ON "users" USING btree ("telegram_handle");