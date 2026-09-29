CREATE TYPE "public"."email_template_kind" AS ENUM('welcome', 'announcement', 'reminder', 'promotion', 'certificate_issued', 're_engagement', 'custom');--> statement-breakpoint
CREATE TYPE "public"."campaign_event_type" AS ENUM('delivered', 'opened', 'clicked', 'bounced', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."campaign_send_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."coupon_kind" AS ENUM('percentage', 'fixed', 'full_access');--> statement-breakpoint
CREATE TYPE "public"."affiliate_event_type" AS ENUM('click', 'signup', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('pending', 'approved', 'suspended', 'declined');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'held', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."testimonial_request_status" AS ENUM('open', 'submitted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."testimonial_status" AS ENUM('pending', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."testimonial_trigger" AS ENUM('completion', 'five_star_rating', 'manual');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_category" AS ENUM('question', 'bug', 'billing', 'other');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TABLE "email_template_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_template_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"template_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"subject" varchar(150) NOT NULL,
	"preheader" varchar(300),
	"document" jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_template_versions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "version_positive_check" CHECK ("email_template_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"kind" "email_template_kind" DEFAULT 'custom' NOT NULL,
	"draft_document" jsonb,
	"draft_subject" varchar(150),
	"draft_preheader" varchar(300),
	"current_version" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "email_templates_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" bigint NOT NULL,
	"send_id" bigint,
	"user_id" text,
	"email" varchar(320) NOT NULL,
	"eventType" "campaign_event_type" NOT NULL,
	"link_url" text,
	"link_label" varchar(200),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_events_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_sends" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_sends_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" bigint NOT NULL,
	"user_id" text,
	"email" varchar(320) NOT NULL,
	"status" "campaign_send_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_sends_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"subject" varchar(150) NOT NULL,
	"preheader" varchar(300),
	"template_id" bigint,
	"template_version_id" bigint,
	"audience" jsonb NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"recipient_count" integer,
	"duplicated_from_id" bigint,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "campaign_schedule_future_check" CHECK ("campaigns"."scheduled_for" IS NULL OR "campaigns"."sent_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "coupon_courses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_courses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"coupon_id" bigint NOT NULL,
	"course_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" bigint NOT NULL,
	"user_id" text,
	"purchase_id" bigint,
	"amount_discounted" numeric(19, 4) NOT NULL,
	"currency" char(3) DEFAULT 'ETB' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" numeric(19, 4),
	"currency" char(3) DEFAULT 'ETB' NOT NULL,
	"max_redemptions" integer,
	"expires_at" timestamp with time zone,
	"stackable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"batch_id" uuid,
	"batch_label" varchar(200),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "coupons_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "coupon_percentage_check" CHECK ("coupons"."kind" <> 'percentage' OR ("coupons"."value" >= 1 AND "coupons"."value" <= 99)),
	CONSTRAINT "coupon_fixed_check" CHECK ("coupons"."kind" <> 'fixed' OR "coupons"."value" > 0),
	CONSTRAINT "coupon_full_access_check" CHECK ("coupons"."kind" <> 'full_access' OR "coupons"."value" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "affiliate_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "affiliate_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"affiliate_id" bigint NOT NULL,
	"link_id" bigint,
	"eventType" "affiliate_event_type" NOT NULL,
	"user_id" text,
	"purchase_id" bigint,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "affiliate_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" bigint NOT NULL,
	"course_id" bigint,
	"code" varchar(60) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_links_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "affiliates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"status" "affiliate_status" DEFAULT 'pending' NOT NULL,
	"audience" text,
	"channels" text,
	"decision_note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"commissions_held" boolean DEFAULT false NOT NULL,
	"fraud_flagged_at" timestamp with time zone,
	"fraud_evidence" jsonb,
	"payout_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "affiliates_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "affiliates_email_check" CHECK ("affiliates"."email" <> '')
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" bigint NOT NULL,
	"purchase_id" bigint,
	"link_id" bigint,
	"rate" numeric(5, 2) NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" char(3) DEFAULT 'ETB' NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"payout_id" bigint,
	"reversed_reason" text,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "commission_rate_check" CHECK ("commissions"."rate" >= 0 AND "commissions"."rate" <= 100),
	CONSTRAINT "commission_amount_check" CHECK ("commissions"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" bigint NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" char(3) DEFAULT 'ETB' NOT NULL,
	"method" varchar(60) NOT NULL,
	"status" "affiliate_payout_status" DEFAULT 'pending' NOT NULL,
	"reference" varchar(200),
	"notes" text,
	"processed_by" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "payout_amount_check" CHECK ("payouts"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "testimonial_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "testimonial_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"course_id" bigint NOT NULL,
	"trigger" "testimonial_trigger" NOT NULL,
	"status" "testimonial_request_status" DEFAULT 'open' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testimonial_requests_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "testimonials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"course_id" bigint NOT NULL,
	"quote" varchar(400) NOT NULL,
	"rating" smallint,
	"consent_confirmed" boolean DEFAULT false NOT NULL,
	"status" "testimonial_status" DEFAULT 'pending' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"featured_at" timestamp with time zone,
	"edited_by" text,
	"edited_at" timestamp with time zone,
	"edit_note" varchar(200),
	"heavy_edit" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"request_id" bigint,
	"trigger" "testimonial_trigger" DEFAULT 'manual' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testimonials_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "testimonial_quote_check" CHECK (LENGTH("testimonials"."quote") >= 20 AND LENGTH("testimonials"."quote") <= 400),
	CONSTRAINT "testimonial_rating_check" CHECK ("testimonials"."rating" IS NULL OR ("testimonials"."rating" >= 1 AND "testimonials"."rating" <= 5)),
	CONSTRAINT "testimonial_consent_check" CHECK ("testimonials"."status" <> 'published' OR "testimonials"."consent_confirmed")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_tickets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" "support_ticket_category" DEFAULT 'question' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"current_screen" varchar(300),
	"status" "support_ticket_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "support_tickets_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "tour_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_send_id_campaign_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."campaign_sends"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_version_id_email_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."email_template_versions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_courses" ADD CONSTRAINT "coupon_courses_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_courses" ADD CONSTRAINT "coupon_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliate_events" ADD CONSTRAINT "affiliate_events_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliate_events" ADD CONSTRAINT "affiliate_events_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliate_events" ADD CONSTRAINT "affiliate_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliate_events" ADD CONSTRAINT "affiliate_events_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonial_requests" ADD CONSTRAINT "testimonial_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonial_requests" ADD CONSTRAINT "testimonial_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_template_versions_public" ON "email_template_versions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_template_versions_unique" ON "email_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "idx_email_template_versions_template" ON "email_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_templates_public" ON "email_templates" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_email_templates_kind" ON "email_templates" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_email_templates_updated" ON "email_templates" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaign_events_public" ON "campaign_events" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_events_funnel" ON "campaign_events" USING btree ("campaign_id","eventType");--> statement-breakpoint
CREATE INDEX "idx_campaign_events_link" ON "campaign_events" USING btree ("campaign_id","link_url");--> statement-breakpoint
CREATE INDEX "idx_campaign_events_send" ON "campaign_events" USING btree ("send_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaign_sends_public" ON "campaign_sends" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaign_sends_recipient" ON "campaign_sends" USING btree ("campaign_id","email");--> statement-breakpoint
CREATE INDEX "idx_campaign_sends_campaign_status" ON "campaign_sends" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "idx_campaign_sends_user" ON "campaign_sends" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaigns_public" ON "campaigns" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_campaigns_created" ON "campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupon_courses_unique" ON "coupon_courses" USING btree ("coupon_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_courses_course" ON "coupon_courses" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupon_redemptions_public" ON "coupon_redemptions" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_redemptions_coupon" ON "coupon_redemptions" USING btree ("coupon_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coupon_redemptions_user" ON "coupon_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_redemptions_purchase" ON "coupon_redemptions" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupons_public" ON "coupons" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupons_code" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_coupons_batch" ON "coupons" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_coupons_active" ON "coupons" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE INDEX "idx_affiliate_events_affiliate_type" ON "affiliate_events" USING btree ("affiliate_id","eventType");--> statement-breakpoint
CREATE INDEX "idx_affiliate_events_purchase" ON "affiliate_events" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_affiliate_events_user" ON "affiliate_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_affiliate_links_public" ON "affiliate_links" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_affiliate_links_code" ON "affiliate_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_affiliate_links_affiliate" ON "affiliate_links" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_affiliates_public" ON "affiliates" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_affiliates_status" ON "affiliates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_affiliates_user" ON "affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_commissions_public" ON "commissions" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_commissions_affiliate_status" ON "commissions" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE INDEX "idx_commissions_purchase" ON "commissions" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_commissions_payout" ON "commissions" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payouts_public" ON "payouts" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_affiliate" ON "payouts" USING btree ("affiliate_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payouts_status" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_testimonial_requests_public" ON "testimonial_requests" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_testimonial_requests_status" ON "testimonial_requests" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "idx_testimonial_requests_student_course" ON "testimonial_requests" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_testimonials_public" ON "testimonials" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_testimonials_status" ON "testimonials" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_testimonials_course" ON "testimonials" USING btree ("course_id","featured");--> statement-breakpoint
CREATE INDEX "idx_testimonials_student" ON "testimonials" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_support_tickets_public" ON "support_tickets" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_user" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");