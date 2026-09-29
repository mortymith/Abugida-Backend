-- Unique index on the lowercased affiliate email, from the marketing schema
-- change that adds `uniqueIndex('idx_affiliates_email').on(sql`lower(${table.email})`)`
-- to packages/database/src/schema/marketing/affiliates.ts.
--
-- `inviteAffiliateImpl` relies on this to reject a duplicate application instead
-- of stacking applications for one email.
--
-- Guarded so it is safe against a database that already has the index. The dev
-- database does: it was created by `db:push` before migrations were versioned,
-- and this file has no `drizzle.__drizzle_migrations` bookkeeping behind it.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_affiliates_email"
  ON "affiliates" USING btree (lower("email"));
