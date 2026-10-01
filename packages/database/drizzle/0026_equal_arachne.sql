ALTER TABLE "courses" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_library" ALTER COLUMN "organization_id" SET NOT NULL;--> Reached only after 0025's backfill, so every pre-tenancy row now has an
--> owner. A database with no organization at all fails here — loudly, on
--> purpose: silently leaving rows unscoped would be worse than refusing to run.
