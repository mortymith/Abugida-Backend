ALTER TYPE "public"."audit_action" ADD VALUE 'settings_saved';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'team_invited';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'team_role_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'team_member_removed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'api_key_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'api_key_rotated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'api_key_revoked';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'webhook_saved';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'webhook_tested';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'security_policy_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'role_permissions_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'retention_policy_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'data_erased';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_purged';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_transferred';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_restored';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'branding_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'billing_changed';--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "role_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "role_changed_by" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "purge_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "restore_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "transferred_to_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "transfer_status" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "transfer_token_hash" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_organization_purge_scheduled" ON "organization" USING btree ("purge_scheduled_at") WHERE "organization"."purge_scheduled_at" IS NOT NULL AND "organization"."purged_at" IS NULL;