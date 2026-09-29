ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
DROP INDEX "idx_users_status";--> statement-breakpoint
DROP INDEX "idx_users_deleted";--> statement-breakpoint
DROP INDEX "idx_users_deletion_sla";--> statement-breakpoint
DROP INDEX "idx_users_retention";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "hash_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("account_status","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_users_deleted" ON "users" USING btree ("deleted_at") WHERE "users"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_deletion_sla" ON "users" USING btree ("deletion_requested_at") WHERE "users"."deletion_requested_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_retention" ON "users" USING btree ("retention_expires_at") WHERE "users"."retention_expires_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "telegram_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "telegram_username";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "telegram_phone_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "accountStatus";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_active_at";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "telegram_id";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "telegram_username";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_trio_check" CHECK (("users"."phone_number_encrypted" IS NULL) = ("users"."phone_number_hash" IS NULL)
          AND ("users"."phone_number_last4" IS NULL) = ("users"."phone_number_hash" IS NULL));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_after_request_check" CHECK ("users"."deleted_at" IS NULL OR "users"."deletion_requested_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_completion_after_request_check" CHECK ("users"."deletion_completed_at" IS NULL OR "users"."deletion_requested_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_retention_after_request_check" CHECK ("users"."retention_expires_at" IS NULL OR "users"."deletion_requested_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_device_count_check" CHECK ("users"."device_count" >= 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_max_devices_check" CHECK ("users"."max_devices" BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_hash_version_check" CHECK ("users"."hash_version" >= 1);