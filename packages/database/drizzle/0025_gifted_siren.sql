ALTER TABLE "courses" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "asset_library" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_library" ADD CONSTRAINT "asset_library_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_courses_organization" ON "courses" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_asset_library_organization" ON "asset_library" USING btree ("organization_id","created_at");--> Data backfill. Rows that predate tenancy have no recorded owner, so they are
--> assigned to the earliest workspace — the only deterministic choice, and one
--> that never deletes data. `NOT NULL` is applied in the following migration, so
--> a database with no organization at all fails loudly there instead of
--> silently orphaning rows.
UPDATE "courses" SET "organization_id" = (SELECT "id" FROM "organization" ORDER BY "created_at" LIMIT 1) WHERE "organization_id" IS NULL AND EXISTS (SELECT 1 FROM "organization");--> statement-breakpoint
UPDATE "asset_library" SET "organization_id" = (SELECT "id" FROM "organization" ORDER BY "created_at" LIMIT 1) WHERE "organization_id" IS NULL AND EXISTS (SELECT 1 FROM "organization");
