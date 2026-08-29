#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# PgBouncer Authentication Initialization (one-shot setup job)
#
# Prepares PgBouncer's SCRAM pass-through auth layer:
#   1. Copies each connecting user's SCRAM verifier VERBATIM from
#      pg_authid into userlist.txt. PostgreSQL generates every hash —
#      no password material is hardcoded or committed to git (ADR-006).
#   2. Removes the legacy 'pgbouncer' auth_user role (the auth_query
#      design it served was replaced by auth_file SCRAM pass-through).
#
# Runs BEFORE the pgbouncer service on every `up` (compose depends_on).
# Idempotent; safe to re-run at any time.
#
# Required environment:
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# Optional environment:
#   PGBOUNCER_AUTH_USERS  comma-separated extra roles to expose through
#                         the pooler (defaults to POSTGRES_USER only)
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PGHOST="${PGHOST:-postgres-primary}"
PGPORT="${PGPORT:-5432}"
AUTH_DIR="${AUTH_DIR:-/auth}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [pgbouncer-init] $*"; }
die() {
  echo "[pgbouncer-init][ERROR] $*" >&2
  exit 1
}

# ── Validate environment ────────────────────────────────────────────────
for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB; do
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

# ── Remove legacy auth_query-era objects ────────────────────────────────
# Older volumes carry the retired 'pgbouncer' auth_user role and the
# 'pgbouncer_users' credentials table (which also stored a stale SCRAM
# verifier). Neither is used by the auth_file pass-through design.
legacy_role="$(${PSQL[@]} -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer'")"
if [ "${legacy_role}" = "1" ]; then
  log "Removing legacy 'pgbouncer' auth_user role and its grants..."
  ${PSQL[@]} -c 'DROP OWNED BY pgbouncer;'
  ${PSQL[@]} -c 'DROP ROLE IF EXISTS pgbouncer;'
fi
if ${PSQL[@]} -tAc "SELECT to_regclass('public.pgbouncer_users') IS NOT NULL" | grep -q t; then
  log "Dropping legacy 'pgbouncer_users' credentials table..."
  ${PSQL[@]} -c 'DROP TABLE IF EXISTS public.pgbouncer_users;'
fi

# ── Write userlist.txt from PostgreSQL's own SCRAM verifiers ────────────
users="${PGBOUNCER_AUTH_USERS:-${POSTGRES_USER}}"
mkdir -p "${AUTH_DIR}"
tmp_file=$(mktemp)

for user in $(echo "${users}" | tr ',' ' '); do
  verifier="$(${PSQL[@]} -tAc "SELECT rolpassword FROM pg_authid WHERE rolname = '${user}'")"
  [ -n "${verifier}" ] || die "No password stored for role '${user}' — cannot expose it through PgBouncer"
  case "${verifier}" in
  SCRAM-SHA-256\$*) ;;
  *) die "Password for '${user}' is not a SCRAM-SHA-256 secret — refusing (md5/plaintext would break pass-through)" ;;
  esac
  printf '"%s" "%s"\n' "${user}" "${verifier}" >> "${tmp_file}"
  log "Added SCRAM verifier for user: ${user}"
done

chmod 644 "${tmp_file}"
mv "${tmp_file}" "${AUTH_DIR}/userlist.txt"

# ── Verification report ────────────────────────────────────────────────
log "Verification:"
log "userlist.txt written to ${AUTH_DIR}/userlist.txt ($(wc -l < "${AUTH_DIR}/userlist.txt") entries, verifiers redacted)"
log "PgBouncer initialization complete."
