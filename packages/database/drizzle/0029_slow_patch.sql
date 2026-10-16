CREATE TYPE "public"."payout_attempt_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "commission_balances" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commission_balances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" bigint NOT NULL,
	"balance_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"balance_currency" char(3) DEFAULT 'ETB' NOT NULL,
	"last_payout_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_balances_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "payout_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payout_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" bigint NOT NULL,
	"attempt_number" integer NOT NULL,
	"method" varchar(60) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "payout_attempt_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"bank_reference" varchar(200),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_attempts_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "testimonial_edit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "testimonial_edit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"testimonial_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"quote" text NOT NULL,
	"edited_by" text,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"classification" varchar(10),
	"change_summary" varchar(200),
	CONSTRAINT "testimonial_edit_log_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD COLUMN "in_app_delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD COLUMN "telegram_delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "excluded_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "exclusion_reasons" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "parent_campaign_id" bigint;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "revoke_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "expected_amount" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "payable_amount" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "variance_amount" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "deferred_amount" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "conversion_rate" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "conversion_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "edit_classification" varchar(10);--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "original_quote" text;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "lang" varchar(10);--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "reconfirmation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "reconfirmation_status" varchar(20);--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "reconfirmation_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "opted_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "opted_out_by" varchar(20);--> statement-breakpoint
ALTER TABLE "commission_balances" ADD CONSTRAINT "commission_balances_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_attempts" ADD CONSTRAINT "payout_attempts_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonial_edit_log" ADD CONSTRAINT "testimonial_edit_log_testimonial_id_testimonials_id_fk" FOREIGN KEY ("testimonial_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "testimonial_edit_log" ADD CONSTRAINT "testimonial_edit_log_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_commission_balances_public" ON "commission_balances" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_commission_balances_affiliate" ON "commission_balances" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payout_attempts_public" ON "payout_attempts" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payout_attempts_payout_number" ON "payout_attempts" USING btree ("payout_id","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_payout_attempts_payout" ON "payout_attempts" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "idx_payout_attempts_status" ON "payout_attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_testimonial_edit_log_public" ON "testimonial_edit_log" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_testimonial_edit_log_testimonial_version" ON "testimonial_edit_log" USING btree ("testimonial_id","version");--> statement-breakpoint
CREATE INDEX "idx_testimonial_edit_log_testimonial" ON "testimonial_edit_log" USING btree ("testimonial_id");