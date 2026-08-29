#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# PowerSync PostgreSQL Initialization (one-shot setup job)
#
# Idempotently applies everything PowerSync needs on the source database:
#   1. Role passwords (from env — never hardcoded, per ADR-006)
#   2. Replication-role read grants + default privileges
#   3. The "powersync" publication (required — replication never starts
#      without a publication of exactly this name)
#   4. Storage-role CREATE grant (PowerSync manages its own schema)
#
# Runs BOTH against fresh volumes and existing ones (unlike the
# /docker-entrypoint-initdb.d scripts in docker/config/postgres/init/,
# which only execute on first boot). Safe to re-run at any time.
#
# Required environment:
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   PS_REPLICATION_PASSWORD, PS_STORAGE_PASSWORD
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PGHOST="${PGHOST:-postgres-primary}"
PGPORT="${PGPORT:-5432}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [powersync-init] $*"; }
die() {
  echo "[powersync-init][ERROR] $*" >&2
  exit 1
}

# ── Validate environment ────────────────────────────────────────────────
for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB \
  PS_REPLICATION_PASSWORD PS_STORAGE_PASSWORD; do
  [ -n "${!var:-}" ] || die "$var is not set"
done

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql --host "$PGHOST" --port "$PGPORT" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1)

# ── Connectivity + version check ────────────────────────────────────────
for attempt in $(seq 1 30); do
  if pg_version="$(${PSQL[@]} -t -A -c 'SHOW server_version;' 2> /dev/null)"; then
    break
  fi
  log "Postgres not ready (attempt $attempt/30), retrying in 2s..."
  sleep 2
done
[ -n "${pg_version:-}" ] || die "Could not connect to ${PGHOST}:${PGPORT}"
pg_major="${pg_version%%.*}"
[ "${pg_major}" -ge 14 ] || die "PostgreSQL ${pg_major} detected — PowerSync requires >= 14"
log "Connected to ${PGHOST}:${PGPORT} (PostgreSQL ${pg_version})"

# ── Apply roles, grants, publication (idempotent) ───────────────────────
log "Applying PowerSync roles and grants..."
${PSQL[@]} << EOSQL
-- Replication role: ensure it exists, then set password from env
-- (covers both fresh installs and credential rotation).
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'powersync') THEN
        EXECUTE format('CREATE ROLE powersync WITH REPLICATION BYPASSRLS LOGIN PASSWORD %L',
            '${PS_REPLICATION_PASSWORD}');
        RAISE NOTICE 'Created replication role: powersync';
    ELSE
        EXECUTE format('ALTER ROLE powersync WITH REPLICATION BYPASSRLS LOGIN PASSWORD %L',
            '${PS_REPLICATION_PASSWORD}');
        RAISE NOTICE 'Replication role present: powersync (password synced)';
    END IF;
END
\$\$;

GRANT USAGE ON SCHEMA public TO powersync;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync;

-- Storage role: least privilege — CREATE on database only. PowerSync
-- creates/migrates its own "powersync" schema under this role.
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'powersync_storage') THEN
        EXECUTE format('CREATE ROLE powersync_storage WITH LOGIN PASSWORD %L',
            '${PS_STORAGE_PASSWORD}');
        RAISE NOTICE 'Created storage role: powersync_storage';
    ELSE
        EXECUTE format('ALTER ROLE powersync_storage WITH LOGIN PASSWORD %L',
            '${PS_STORAGE_PASSWORD}');
        RAISE NOTICE 'Storage role present: powersync_storage (password synced)';
    END IF;
END
\$\$;

GRANT CREATE ON DATABASE ${POSTGRES_DB} TO powersync_storage;
GRANT USAGE ON SCHEMA public TO powersync_storage;

-- Publication must be named exactly "powersync".
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
        CREATE PUBLICATION powersync FOR ALL TABLES;
        RAISE NOTICE 'Created publication: powersync';
    ELSE
        RAISE NOTICE 'Publication already exists: powersync';
    END IF;
END
\$\$;
EOSQL

# ── Verification report ────────────────────────────────────────────────
log "Verification:"
${PSQL[@]} -c "
SELECT rolname, rolreplication, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname IN ('powersync', 'powersync_storage');"
${PSQL[@]} -c "
SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'powersync';"

log "PowerSync initialization complete."
