CREATE TYPE "public"."course_content_language" AS ENUM('en', 'am', 'ti', 'gez');--> statement-breakpoint
CREATE TYPE "public"."lesson_visibility" AS ENUM('draft', 'published', 'scheduled');--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "content_language" "course_content_language" DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "visibility" "lesson_visibility" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "scheduled_publish_at" timestamp with time zone;-- Backfill: `lessons.visibility` defaults to 'draft', which is correct for new
-- items but would silently empty every already-live course — its items would
-- drop out of the published set and its students would see an empty curriculum.
-- A lesson that belongs to a published course is therefore 'published'.
UPDATE "lessons" l
   SET "visibility" = 'published'
  FROM "courses" c
 WHERE c."id" = l."course_id"
   AND c."status" = 'published'
   AND c."deleted_at" IS NULL
   AND l."deleted_at" IS NULL;--> statement-breakpoint
-- `courses.approved_at` is new, so a course already carrying an approved
-- course-level review request is backfilled into the Approved state rather than
-- dropping back to a plain Draft on upgrade. Mirrors the catalog's Approved
-- filter predicate exactly (spec 04, S-2.1).
UPDATE "courses" c
   SET "approved_at" = r."decided_at"
  FROM "review_requests" r
 WHERE r."course_id" = c."id"
   AND r."entity_type" = 'course'
   AND r."state" = 'approved'
   AND r."decided_at" IS NOT NULL
   AND c."status" = 'draft'
   AND c."deleted_at" IS NULL
   AND r."decided_at" = (
     SELECT MAX(r2."decided_at") FROM "review_requests" r2
      WHERE r2."course_id" = c."id"
        AND r2."entity_type" = 'course'
        AND r2."state" = 'approved'
   );
