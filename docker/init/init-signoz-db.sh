#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# SigNoz Metadata Store Initialization (one-shot setup job)
#
# Idempotently provisions everything SigNoz needs in PostgreSQL:
#   1. The "signoz" LOGIN role with password from env (never hardcoded,
#      per ADR-006) — covers fresh installs AND credential rotation.
#   2. The "signoz" database, owned by that role (SigNoz runs its own
#      schema migrations inside it).
#
# Runs on EVERY stack start (compose depends_on), before pgbouncer-init
# — which needs the role to exist so it can copy its SCRAM verifier
# into userlist.txt — and before signoz-frontend connects through the
# pooler. Safe to re-run at any time.
#
# Required environment:
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   SIGNOZ_DB_PASSWORD
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PGHOST="${PGHOST:-postgres-primary}"
PGPORT="${PGPORT:-5432}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [signoz-db-init] $*"; }
die() {
  echo "[signoz-db-init][ERROR] $*" >&2
  exit 1
}

# ── Validate environment ────────────────────────────────────────────────
for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SIGNOZ_DB_PASSWORD; do
  [ -n "${!var:-}" ] || die "$var is not set"
done

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql --host "$PGHOST" --port "$PGPORT" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1)

# ── Connectivity check ──────────────────────────────────────────────────
for attempt in $(seq 1 30); do
  if ${PSQL[@]} -tAc 'SELECT 1;' > /dev/null 2>&1; then
    break
  fi
  log "Postgres not ready (attempt $attempt/30), retrying in 2s..."
  sleep 2
done
${PSQL[@]} -tAc 'SELECT 1;' > /dev/null || die "Could not connect to ${PGHOST}:${PGPORT}"
log "Connected to ${PGHOST}:${PGPORT}"

# ── Role: create if missing, rotate password ONLY when needed ───────────
# NOSUPERUSER/NOCREATEDB/NOCREATEROLE — SigNoz only needs full rights on
# its own database, nothing cluster-wide.
#
# Why conditionally? Every ALTER ROLE ... PASSWORD regenerates the SCRAM
# verifier with a fresh random salt — even for an unchanged password. A
# new verifier invalidates the copy cached in a LIVE PgBouncer (SCRAM
# pass-through validates clients against its in-memory keys), silently
# breaking auth until the pooler restarts. So: probe whether the stored
# password already authenticates, and only ALTER when it doesn't.
log "Checking signoz role..."
role_exists="$(${PSQL[@]} -tAc "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'signoz'")"
if [ "${role_exists}" != "1" ]; then
  log "Creating role: signoz"
  ${PSQL[@]} -c "CREATE ROLE signoz WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${SIGNOZ_DB_PASSWORD}'"
else
  # Probe: does the stored password still match what we were given?
  if PGPASSWORD="${SIGNOZ_DB_PASSWORD}" psql --host "$PGHOST" --port "$PGPORT" \
    --username signoz --dbname postgres -tAc 'SELECT 1;' > /dev/null 2>&1; then
    log "Role present: signoz (password verified, skipping ALTER)"
  else
    log "Role present: signoz (password differs — rotating)"
    ${PSQL[@]} -c "ALTER ROLE signoz WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${SIGNOZ_DB_PASSWORD}'"
  fi
fi

# ── Database: owned by the signoz role ──────────────────────────────────
# CREATE DATABASE cannot run inside DO/transaction blocks.
db_exists="$(${PSQL[@]} -tAc "SELECT 1 FROM pg_database WHERE datname = 'signoz'")"
if [ "${db_exists}" != "1" ]; then
  log "Creating database: signoz (owner=signoz)"
  ${PSQL[@]} -c "CREATE DATABASE signoz OWNER signoz"
else
  # Re-assert ownership so a re-run after manual drift converges.
  ${PSQL[@]} -c "ALTER DATABASE signoz OWNER TO signoz"
  log "Database present: signoz (owner re-asserted)"
fi

# ── Verification report ────────────────────────────────────────────────
log "Verification:"
${PSQL[@]} -c "SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'signoz';"
${PSQL[@]} -c "SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = 'signoz';"

log "SigNoz metadata store initialization complete."
