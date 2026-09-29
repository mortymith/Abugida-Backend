-- RECONSTRUCTED 2026-09-29 — this file was missing from version control.
--
-- `drizzle/meta/_journal.json` referenced `0015_seed_exam_types` (idx 15) but no
-- SQL file was ever committed, so `drizzle-kit migrate` could not run at all:
-- it walks the journal and aborts on a missing entry. Only `0012` had been
-- force-added; the rest of `drizzle/` sat behind `.gitignore`.
--
-- The drizzle-generated name is misleading. Snapshots 0014 -> 0016 show the
-- migration was a SCHEMA change, not a seed: the only delta is a new
-- `lessons.asset_id` column plus its foreign key. There is no `exam_types`
-- INSERT to restore — the table is empty in every environment and no seed SQL
-- for it exists in the repo, so nothing was lost.
--
-- Reconstructed from three independent sources that agree:
--   1. snapshot delta 0014_snapshot.json -> 0016_snapshot.json
--   2. packages/database/src/schema/catalog/lessons.ts (`assetId`)
--   3. the live dev database (`lessons.asset_id bigint`, nullable)
--
-- Idempotent so a re-run or a partially-applied history is safe.
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "asset_id" bigint;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_asset_id_asset_library_id_fk'
  ) THEN
    ALTER TABLE "lessons"
      ADD CONSTRAINT "lessons_asset_id_asset_library_id_fk"
      FOREIGN KEY ("asset_id") REFERENCES "asset_library"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
