-- 05-init-replication.sql
-- Source: deployment.md v3.0.0, ADR-002
-- Creates the replication user and replication slot.
--
-- The password for 'replicator' comes from the POSTGRES_PASSWORD secret.
-- In dev (Docker secrets), this is the same postgres password.
-- In prod (Vault), Vault populates this at runtime.
--
-- IMPORTANT: This script runs inside the container where $POSTGRES_PASSWORD
-- is available as an environment variable (set via Docker secret _FILE).
-- pg_hba.conf already permits replication from 172.22.0.0/24.

-- ============================================================================
-- Replication user
-- ============================================================================
-- Uses md5 because the password is supplied via environment at container
-- startup. In prod, Vault rotates this credential periodically.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
        EXECUTE format('CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD %L',
            current_setting('POSTGRES_PASSWORD', true));
        RAISE NOTICE 'Created replication user: replicator';
    ELSE
        RAISE NOTICE 'Replication user already exists: replicator';
    END IF;
END
$$;

-- ============================================================================
-- Physical replication slots (one per replica, up to 2) 
-- ============================================================================
-- Slot names match the compose service names: postgres-replica-1, postgres-replica-2
SELECT pg_create_physical_replication_slot('replica_slot_1', false, false)
WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_1');

SELECT pg_create_physical_replication_slot('replica_slot_2', false, false)
WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_2');

-- ============================================================================
-- PgBouncer admin user — RETIRED
-- ============================================================================
-- PgBouncer no longer uses auth_query/auth_user; authentication is SCRAM
-- pass-through via a runtime-generated auth_file. The former 'pgbouncer'
-- role and 'pgbouncer_users' table are removed from pre-existing volumes
-- by docker/init/init-pgbouncer.sh (pgbouncer-init one-shot job).
-- This file deliberately contains NO pgbouncer credentials.

-- ============================================================================
-- PowerSync logical replication user (bypasses PgBouncer — see docs/services/powersync.md)
-- ============================================================================
-- Uses REPLICATION privilege for logical decoding. Connects directly to
-- postgres-primary:5432 (not through PgBouncer, which would break the
-- persistent connection required for logical replication streaming).
--
-- Read grants + the "powersync" publication are created by
-- 06-init-powersync.sql; passwords are injected by docker/init/init-powersync.sh.
--
-- NOTE: No replication slot is pre-created here. PowerSync creates and owns
-- its own logical slot — a manually created slot PowerSync doesn't consume
-- would retain WAL segments indefinitely (WAL-bloat risk).
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'powersync') THEN
        EXECUTE format('CREATE ROLE powersync WITH REPLICATION LOGIN PASSWORD %L',
            current_setting('POSTGRES_PASSWORD', true));
        RAISE NOTICE 'Created PowerSync replication user: powersync';
    ELSE
        RAISE NOTICE 'PowerSync replication user already exists: powersync';
    END IF;
END
$$;
