#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# PostgreSQL Backup — WAL Archiving + Daily pg_dump + S3 Upload (§9, ADR-002, ADR-005)
# ═════════════════════════════════════════════════════════════════════════════════
#
# Three backup mechanisms:
#   1. Continuous WAL archiving (always-on, configured in postgresql.conf)
#      WAL segments are written to postgres_wal volume + uploaded to S3
#   2. Daily pg_dump (full logical backup at 02:00)
#      Custom format, compressed, with checksum verification
#   3. Storage tiering: local (30d) → S3 (90d) → Glacier (365d)
#
# Usage:
#   bash scripts/backup/backup-postgres.sh              # Full dump + WAL upload
#   bash scripts/backup/backup-postgres.sh --wal-only     # WAL segment upload only
#   bash scripts/backup/backup-postgres.sh --dump-only    # Skip WAL, just pg_dump
#
# S3 Lifecycle (encoded in s3-lifecycle.json, applied via aws cli):
#   0-30 days:   S3 Standard (hot restore)
#   30-90 days:  S3 Infrequent Access
#   90-365 days: Glacier Deep Archive
#   365+ days:   Expired (deleted)
# ═════════════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CONTAINER="${COMPOSE_PROJECT}_postgres-primary"
BACKUP_DIR="./data/backups/postgres"
WAL_LOCAL_DIR="./data/backups/postgres/wal"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"

# S3 configuration
S3_BUCKET="${BACKUP_S3_BUCKET:-infrastructure-backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-postgres/${ENVIRONMENT:-production}}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Load .env.prod for S3 credentials if available
if [ -f .env.prod ]; then
  _aws_key=$(grep -E '^AWS_ACCESS_KEY_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _aws_secret=$(grep -E '^AWS_SECRET_ACCESS_KEY=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${_aws_key:-}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${_aws_secret:-}}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TELEGRAM_SH="${SCRIPT_DIR}/telegram-notify.sh"

MODE="${1:-full}"
FAILED=0

# ── Create directories ────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}" "${WAL_LOCAL_DIR}"

# ── Check container ───────────────────────────────────────────────
check_container() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "[backup-postgres][ERROR] Container ${CONTAINER} is not running."
    return 1
  fi
}

# ── S3 upload helper ──────────────────────────────────────────────
s3_upload() {
  local src="$1"
  local dest="$2"
  if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    aws s3 cp "${src}" "s3://${S3_BUCKET}/${dest}" --region "${AWS_REGION}" 2> /dev/null && echo "  Uploaded to s3://${S3_BUCKET}/${dest}"
  else
    echo "  (S3 upload skipped — aws CLI or credentials not configured)"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# 1. WAL ARCHIVE (continuous) — §9.1 diagram node
# ═════════════════════════════════════════════════════════════════════
backup_wal() {
  echo "[backup-postgres] Archiving WAL segments..."
  check_container || return 1

  # List WAL files in the archive directory inside the container
  WAL_FILES=$(docker exec "${CONTAINER}" sh -c 'ls -1 /var/lib/postgresql/wal_archive/ 2>/dev/null | grep -E "^[0-9A-F]+$"' || true)

  if [ -z "${WAL_FILES}" ]; then
    echo "[backup-postgres] No new WAL segments to archive."
    return 0
  fi

  WAL_COUNT=0
  while IFS= read -r WAL_FILE; do
    [ -z "${WAL_FILE}" ] && continue
    # Copy WAL segment from container to local
    docker cp "${CONTAINER}:/var/lib/postgresql/wal_archive/${WAL_FILE}" "${WAL_LOCAL_DIR}/${WAL_FILE}" 2> /dev/null || true
    # Upload to S3
    s3_upload "${WAL_LOCAL_DIR}/${WAL_FILE}" "${S3_PREFIX}/wal/${DATE_ONLY}/${WAL_FILE}"
    WAL_COUNT=$((WAL_COUNT + 1))
  done <<< "${WAL_FILES}"

  # Prune local WAL files older than 7 days (WAL is also on S3)
  find "${WAL_LOCAL_DIR}" -type f -mtime "+7" -delete 2> /dev/null || true

  echo "[backup-postgres][OK] Archived WAL segments to ${WAL_LOCAL_DIR}/"
}

# ═════════════════════════════════════════════════════════════════════
# 2. DAILY pg_dump (logical) — §9.1 diagram node
# ═════════════════════════════════════════════════════════════════════
backup_dump() {
  echo "[backup-postgres] Creating pg_dump (custom format, compressed)..."
  check_container || return 1

  BACKUP_FILE="${BACKUP_DIR}/pg_backup_${TIMESTAMP}.dump"
  CHECKSUM_FILE="${BACKUP_FILE}.sha256"

  # H-04 Fix: Pass PGPASSWORD so pg_dump can authenticate
  # with scram-sha-256 (PostgreSQL 17 default, H-05 change)
  # ADR-006: env var first, then .env fallback, then Vault.
  POSTGRES_PASSWORD_VAL="${POSTGRES_PASSWORD:-}"
  if [ -z "${POSTGRES_PASSWORD_VAL}" ] && [ -f .env ]; then
    POSTGRES_PASSWORD_VAL=$(grep -E '^POSTGRES_PASSWORD=' .env 2> /dev/null | head -1 | cut -d'=' -f2- || true)
  fi
  if [ -z "${POSTGRES_PASSWORD_VAL}" ]; then
    # Try Vault in production
    if [ -n "${VAULT_ADDR:-}" ] && [ -n "${VAULT_TOKEN:-}" ]; then
      POSTGRES_PASSWORD_VAL=$(vault read -format=json -field value secret/data/postgres 2> /dev/null || echo '')
    fi
  fi
  if [ -z "${POSTGRES_PASSWORD_VAL}" ]; then
    echo "[backup-postgres][ERROR] Could not obtain PostgreSQL password from environment or Vault"
    return 1
  fi

  # pg_dump in custom format (-Fc) for parallel restore capability
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD_VAL}" "${CONTAINER}" pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -Fc \
    -Z6 \
    > "${BACKUP_FILE}" 2> /dev/null

  if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[backup-postgres][ERROR] pg_dump produced empty file."
    return 1
  fi

  # Checksum verification
  sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
  echo "[backup-postgres] Checksum: $(cat "${CHECKSUM_FILE}" | cut -d' ' -f1)"

  # Upload to S3
  s3_upload "${BACKUP_FILE}" "${S3_PREFIX}/dumps/${DATE_ONLY}/pg_backup_${TIMESTAMP}.dump"
  s3_upload "${CHECKSUM_FILE}" "${S3_PREFIX}/dumps/${DATE_ONLY}/pg_backup_${TIMESTAMP}.dump.sha256"

  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[backup-postgres][OK] Dump complete: ${BACKUP_FILE} (${SIZE})"

  # Record timestamp for backup-status
  echo "${TIMESTAMP}" > "${BACKUP_DIR}/.last-backup"
}

# ═════════════════════════════════════════════════════════════════════
# Main dispatch
# ═════════════════════════════════════════════════════════════════════
case "${MODE}" in
--wal-only)
  backup_wal || FAILED=1
  ;;
--dump-only)
  backup_dump || FAILED=1
  ;;
full | *)
  backup_wal || FAILED=1
  backup_dump || FAILED=1
  ;;
esac

# Notify
if [ ${FAILED} -eq 0 ]; then
  bash "${TELEGRAM_SH}" "PostgreSQL backup complete (${MODE})" 2> /dev/null || true
else
  LEVEL=error CONTEXT=backup TASK=postgres bash "${TELEGRAM_SH}" "PostgreSQL backup FAILED (${MODE})" 2> /dev/null || true
  exit 1
fi
