ALTER TYPE "public"."audit_action" ADD VALUE 'auth_mfa_enabled';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'auth_mfa_disabled';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'auth_mfa_recovery_used';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'auth_lockout';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_switched';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_config_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_deleted';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'member_invited';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'member_joined';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'member_removed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'member_role_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'course_role_granted';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'course_role_revoked';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'owner_transfer_initiated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'owner_transfer_accepted';