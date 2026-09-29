CREATE TYPE "public"."bookmark_item_type" AS ENUM('course', 'resource');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"itemType" "bookmark_item_type" DEFAULT 'course' NOT NULL,
	"item_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_public_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_better_auth_id_unique";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_users_better_auth_id_fk";
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_users_better_auth_id_fk";
--> statement-breakpoint
DROP INDEX "idx_users_public_id";--> statement-breakpoint
DROP INDEX "idx_users_better_auth_id";--> statement-breakpoint
-- ORDER FIXED 2026-09-29: `DROP IDENTITY` must precede `SET DATA TYPE text`.
-- Postgres rejects a type change on a column that is still an identity column
-- ("identity column type must be smallint, integer, or bigint").
--
-- !! THIS MIGRATION STILL CANNOT REPLAY FROM SCRATCH. After the reorder it
-- !! fails on `user_profiles.user_id -> text`, because it drops only the
-- !! `*_users_better_auth_id_fk` constraints and leaves
-- !! `user_profiles_user_id_users_id_fk` in place; that FK then spans
-- !! bigint -> text and Postgres refuses the type change. Reconstructing the
-- !! rest of this statement set is guesswork, so it was left alone.
-- !! No environment has ever applied these migrations (there is no
-- !! `drizzle.__drizzle_migrations` table anywhere), which is why the breakage
-- !! went unnoticed. See the branch commit message: replaying 0000-0021 from
-- !! zero needs a decision, and `db:push` remains the supported path.
ALTER TABLE "users" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_consents" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "instructor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "modules" ALTER COLUMN "instructor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "instructor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "course_tags" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "course_bundles" ALTER COLUMN "instructor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "content_licenses" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "content_license_grants" ALTER COLUMN "student_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "student_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "enrollments" ALTER COLUMN "student_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lesson_completions" ALTER COLUMN "student_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ALTER COLUMN "student_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "quiz_answer_history" ALTER COLUMN "changed_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "course_reviews" ALTER COLUMN "student_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "actor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "principals" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "course_roles" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "course_roles" ALTER COLUMN "granted_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "security_events" ALTER COLUMN "actor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "file_metadata" ALTER COLUMN "uploaded_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "refresh_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "verification" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "verification" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bookmarks_public" ON "bookmarks" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bookmarks_unique" ON "bookmarks" USING btree ("user_id","itemType","item_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user_created" ON "bookmarks" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "public_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "display_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "better_auth_id";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "refresh_token";