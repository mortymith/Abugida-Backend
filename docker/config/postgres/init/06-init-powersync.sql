-- 06-init-powersync.sql
-- PowerSync source-database baseline (fresh volumes only).
--
-- The one-shot `powersync-setup` compose service (runs automatically before
-- the sync/api roles on every stack start; also via `just ps-setup`) re-applies
-- ALL of this idempotently — including role passwords — on existing volumes,
-- so this script only provides the fresh-install baseline. It deliberately
-- contains NO credentials: passwords are injected at runtime from
-- PS_REPLICATION_PASSWORD / PS_STORAGE_PASSWORD (ADR-006).
--
-- Requirements per PowerSync docs (see docs/services/powersync.md):
--   1. A publication literally named "powersync" — without it replication
--      never starts.
--   2. A dedicated replication role with REPLICATION (+ read access).
--   3. A separate least-privilege storage role with CREATE on the database;
--      PowerSync creates and manages its own "powersync" schema under it.

-- ============================================================================
-- Replication role read access (role itself is created by 05-init-replication.sql)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'powersync') THEN
        RAISE EXCEPTION 'Role powersync missing — 05-init-replication.sql must run first';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO powersync;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync;

-- Future tables created by migrations are readable automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync;

-- ============================================================================
-- Bucket-storage role (least privilege: CREATE on database, nothing else)
-- PowerSync migrates and owns its "powersync" schema under this role.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'powersync_storage') THEN
        -- Password intentionally unset here; init-powersync.sh sets it from env.
        CREATE ROLE powersync_storage WITH LOGIN;
        RAISE NOTICE 'Created PowerSync storage user: powersync_storage';
    ELSE
        RAISE NOTICE 'PowerSync storage user already exists: powersync_storage';
    END IF;
END
$$;

DO $$
BEGIN
    EXECUTE format('GRANT CREATE ON DATABASE %I TO powersync_storage', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO powersync_storage;

-- ============================================================================
-- Replication publication (must be named exactly "powersync")
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
        CREATE PUBLICATION powersync FOR ALL TABLES;
        RAISE NOTICE 'Created publication: powersync';
    ELSE
        RAISE NOTICE 'Publication already exists: powersync';
    END IF;
END
$$;
