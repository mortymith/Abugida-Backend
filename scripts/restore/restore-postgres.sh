#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# PostgreSQL Restore
# Source: deployment.md v3.0.0, ADR-002, ADR-005
#
# Restores PostgreSQL from a pg_dump custom-format backup (.dump).
# Uses pg_restore for parallel restore capability.
# If no file specified, uses the most recent backup.
#
# Usage:
#   bash scripts/restore/restore-postgres.sh
#   bash scripts/restore/restore-postgres.sh ./data/backups/postgres/pg_backup_20250101_120000.dump
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CONTAINER="${COMPOSE_PROJECT}_postgres-primary"
BACKUP_DIR="./data/backups/postgres"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"

BACKUP_FILE="${1:-}"

# ── Logging ───────────────────────────────────────────────────────
log_info() { echo "[restore-postgres] $*"; }
log_ok() { echo "[restore-postgres][OK] $*"; }
log_err() { echo "[restore-postgres][ERROR] $*" >&2; }

# ── Find latest backup if not specified ────────────────────────────
if [ -z "${BACKUP_FILE}" ]; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/pg_backup_*.dump 2> /dev/null | head -1)
  if [ -z "${BACKUP_FILE}" ]; then
    log_err "No backup files found in ${BACKUP_DIR}"
    exit 1
  fi
  log_info "Using latest backup: ${BACKUP_FILE}"
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  log_err "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# ── Verify checksum if available ───────────────────────────────────
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  log_info "Verifying checksum..."
  if sha256sum -c "${CHECKSUM_FILE}" --quiet 2> /dev/null; then
    log_ok "Checksum verified."
  else
    log_err "Checksum MISMATCH — backup may be corrupted."
    log_err "To force restore, remove ${CHECKSUM_FILE} and re-run."
    exit 1
  fi
fi

# ── Check container is running ────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  log_err "Container ${CONTAINER} is not running."
  exit 1
fi

# ── Get password for authentication (ADR-006: env → .env → Vault) ──
POSTGRES_PASSWORD_VAL="${POSTGRES_PASSWORD:-}"
if [ -z "${POSTGRES_PASSWORD_VAL}" ] && [ -f .env ]; then
  POSTGRES_PASSWORD_VAL=$(grep -E '^POSTGRES_PASSWORD=' .env 2> /dev/null | head -1 | cut -d'=' -f2- || true)
fi
if [ -z "${POSTGRES_PASSWORD_VAL}" ]; then
  if [ -n "${VAULT_ADDR:-}" ] && [ -n "${VAULT_TOKEN:-}" ]; then
    POSTGRES_PASSWORD_VAL=$(vault read -format=json -field value secret/data/postgres 2> /dev/null || echo '')
  fi
fi

# ── Confirm restore ───────────────────────────────────────────────
log_info "WARNING: This will DROP and recreate the '${POSTGRES_DB}' database."
echo "  Backup: ${BACKUP_FILE}"
echo "  Target: ${POSTGRES_DB}"
echo "  Press Ctrl+C to cancel, Enter to continue..."
read -r

# ── Terminate existing connections ─────────────────────────────────
log_info "Terminating existing connections to '${POSTGRES_DB}'..."
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD_VAL}" "${CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" 2> /dev/null || true

# ── Drop and recreate database ─────────────────────────────────────
log_info "Dropping database '${POSTGRES_DB}'..."
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD_VAL}" "${CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" 2>&1

log_info "Creating database '${POSTGRES_DB}'..."
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD_VAL}" "${CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres \
  -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";" 2>&1

# ── Restore via pg_restore (handles custom format -Fc) ─────────────
log_info "Restoring from ${BACKUP_FILE}..."
docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD_VAL}" "${CONTAINER}" \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-privileges --verbose \
  < "${BACKUP_FILE}" 2>&1

log_ok "Restore complete from ${BACKUP_FILE}"
