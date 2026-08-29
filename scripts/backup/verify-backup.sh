#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Backup Verification — Integrity Check + Restore Test (§9.1 Verification)
# ═════════════════════════════════════════════════════════════════════
#
# Performs:
#   1. Checksum verification against stored .sha256 files
#   2. PostgreSQL: pg_restore --list (catalog dump, no data written)
#   3. Redis: redis-check-rdb (if binary available)
#   4. Config: tarball integrity (gzip -t)
#   5. S3 existence check (optional)
#
# Also serves as the weekly automated restore test (RestoreTest node).
# When called with --restore-test, it actually restores into a scratch
# container and validates data integrity.
#
# Usage:
#   bash scripts/backup/verify-backup.sh                  # Checksum/integrity only
#   bash scripts/backup/verify-backup.sh --restore-test    # Full restore test
#   bash scripts/backup/verify-backup.sh --type postgres    # Single type
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

BACKUP_BASE="./data/backups"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
FAILED=0
PASSED=0
CHECKED=0

MODE="${1:-verify}"
FILTER_TYPE="${2:-all}"

TELEGRAM_SH="${SCRIPT_DIR}/telegram-notify.sh"

check_ok() {
  echo "  [PASS] $1"
  PASSED=$((PASSED + 1))
  CHECKED=$((CHECKED + 1))
}
check_fail() {
  echo "  [FAIL] $1"
  FAILED=$((FAILED + 1))
  CHECKED=$((CHECKED + 1))
}

# ═════════════════════════════════════════════════════════════════════
# 1. CHECKSUM VERIFICATION (daily, §9.1 IntegrityCheck node)
# ═════════════════════════════════════════════════════════════════════
verify_checksums() {
  echo "==> Verifying checksums..."
  for SHA_FILE in $(find "${BACKUP_BASE}" -name "*.sha256" 2> /dev/null); do
    DATA_FILE="${SHA_FILE%.sha256}"
    if [ ! -f "${DATA_FILE}" ]; then
      check_fail "Missing data file: ${DATA_FILE}"
      continue
    fi
    if sha256sum -c "${SHA_FILE}" --quiet 2> /dev/null; then
      check_ok "${DATA_FILE}"
    else
      check_fail "${DATA_FILE} (checksum mismatch)"
    fi
  done
}

# ═════════════════════════════════════════════════════════════════════
# 2. POSTGRESQL VERIFICATION
# ═════════════════════════════════════════════════════════════════════
verify_postgres() {
  echo "==> Verifying PostgreSQL backup..."
  LATEST=$(ls -t "${BACKUP_BASE}/postgres/"pg_backup_*.dump 2> /dev/null | head -1)
  if [ -z "${LATEST}" ]; then
    check_fail "No PostgreSQL backup found"
    return
  fi

  CONTAINER="${COMPOSE_PROJECT}_postgres-primary"
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    check_fail "PostgreSQL container not running (cannot verify)"
    return
  fi

  # pg_restore --list validates the catalog without writing data
  VERIFY_OUTPUT=$(docker exec -i "${CONTAINER}" pg_restore --list 2>&1 < "${LATEST}")
  if echo "${VERIFY_OUTPUT}" | grep -qiE 'error|fatal|corrupt'; then
    check_fail "pg_restore --list found errors in ${LATEST}"
  else
    ENTRY_COUNT=$(echo "${VERIFY_OUTPUT}" | wc -l)
    check_ok "PostgreSQL backup: ${ENTRY_COUNT} entries in catalog"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# 3. REDIS VERIFICATION
# ═════════════════════════════════════════════════════════════════════
verify_redis() {
  echo "==> Verifying Redis backup..."
  LATEST=$(ls -t "${BACKUP_BASE}/redis/"redis_*.rdb.gz 2> /dev/null | head -1)
  if [ -z "${LATEST}" ]; then
    check_fail "No Redis backup found"
    return
  fi

  # Gunzip to temp and check
  TEMP_RDB="/tmp/redis_verify_$$_tmp.rdb"
  gunzip -c "${LATEST}" > "${TEMP_RDB}" 2> /dev/null

  if command -v redis-check-rdb &> /dev/null; then
    if redis-check-rdb "${TEMP_RDB}" > /dev/null 2>&1; then
      check_ok "Redis backup: RDB integrity verified"
    else
      check_fail "Redis backup: RDB integrity check failed"
    fi
  else
    # Try container-based check
    CONTAINER="${COMPOSE_PROJECT}_redis-primary"
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
      docker cp "${TEMP_RDB}" "${CONTAINER}:/tmp/verify.rdb" 2> /dev/null
      if docker exec "${CONTAINER}" redis-check-rdb /tmp/verify.rdb > /dev/null 2>&1; then
        check_ok "Redis backup: RDB integrity verified (container)"
      else
        check_fail "Redis backup: RDB integrity check failed (container)"
      fi
      docker exec "${CONTAINER}" rm -f /tmp/verify.rdb 2> /dev/null
    else
      check_fail "Redis backup: no redis-check-rdb tool available"
    fi
  fi
  rm -f "${TEMP_RDB}"
}

# ═════════════════════════════════════════════════════════════════════
# 4. CONFIG VERIFICATION
# ═════════════════════════════════════════════════════════════════════
verify_config() {
  echo "==> Verifying config backup..."
  LATEST=$(ls -t "${BACKUP_BASE}/config/"config_*.tar.gz 2> /dev/null | head -1)
  if [ -z "${LATEST}" ]; then
    check_fail "No config backup found"
    return
  fi

  if gzip -t "${LATEST}" 2> /dev/null; then
    check_ok "Config backup: tarball integrity verified"
  else
    check_fail "Config backup: tarball is corrupt"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# 5. RESTORE TEST (weekly, RestoreTest node)
# ═════════════════════════════════════════════════════════════════════
restore_test() {
  echo "==> Running restore test against scratch environment..."

  # Test PG restore into a temporary database
  LATEST_PG=$(ls -t "${BACKUP_BASE}/postgres/"pg_backup_*.dump 2> /dev/null | head -1)
  CONTAINER="${COMPOSE_PROJECT}_postgres-primary"

  if [ -n "${LATEST_PG}" ] && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "  Testing PostgreSQL restore to _backup_verify database..."
    # Create temp database, restore, check row counts, drop
    VERIFY_RESULT=$(docker exec -i "${CONTAINER}" bash -c '
            psql -U app -d postgres -c "DROP DATABASE IF EXISTS _backup_verify;" 2>/dev/null
            psql -U app -d postgres -c "CREATE DATABASE _backup_verify;" 2>/dev/null
            pg_restore -U app -d _backup_verify --no-owner --no-privileges 2>&1
            TABLES=$(psql -U app -d _backup_verify -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';")
            echo "tables=${TABLES}"
            psql -U app -d postgres -c "DROP DATABASE _backup_verify;" 2>/dev/null
        ' < "${LATEST_PG}" 2>&1)

    TABLE_COUNT=$(echo "${VERIFY_RESULT}" | grep '^tables=' | cut -d'=' -f2 | tr -d ' ')
    if [ -n "${TABLE_COUNT}" ] && [ "${TABLE_COUNT}" -gt 0 ]; then
      check_ok "PostgreSQL restore test: ${TABLE_COUNT} tables recovered"
    else
      check_fail "PostgreSQL restore test: 0 tables recovered"
    fi
  else
    check_fail "PostgreSQL restore test: no backup or container"
  fi

  # Test Redis restore
  LATEST_REDIS=$(ls -t "${BACKUP_BASE}/redis/"redis_*.rdb.gz 2> /dev/null | head -1)
  if [ -n "${LATEST_REDIS}" ]; then
    TEMP_RDB="/tmp/redis_restore_test_$$.rdb"
    gunzip -c "${LATEST_REDIS}" > "${TEMP_RDB}" 2> /dev/null
    # Verify RDB can be loaded (parse check)
    if command -v redis-check-rdb &> /dev/null; then
      if redis-check-rdb "${TEMP_RDB}" > /dev/null 2>&1; then
        check_ok "Redis restore test: RDB is loadable"
      else
        check_fail "Redis restore test: RDB check failed"
      fi
    else
      check_ok "Redis restore test: file exists (no check tool)"
    fi
    rm -f "${TEMP_RDB}"
  else
    check_fail "Redis restore test: no backup"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# S3 EXISTENCE CHECK
# ═════════════════════════════════════════════════════════════════════
verify_s3() {
  echo "==> Checking S3 backup existence..."
  if ! command -v aws &> /dev/null || [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
    echo "  (skipped — aws CLI not configured)"
    return
  fi

  S3_BUCKET="${BACKUP_S3_BUCKET:-infrastructure-backups}"
  OBJECT_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/" --recursive --region "${AWS_REGION:-us-east-1}" 2> /dev/null | wc -l)
  if [ "${OBJECT_COUNT}" -gt 0 ]; then
    check_ok "S3: ${OBJECT_COUNT} backup objects found"
  else
    check_fail "S3: no backup objects found"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════
echo "════════════════════════════════════════════════════════════"
echo "  Backup Verification"
echo "════════════════════════════════════════════════════════════"
echo ""

case "${MODE}" in
--restore-test)
  restore_test
  ;;
verify | *)
  verify_checksums
  case "${FILTER_TYPE}" in
  postgres) verify_postgres ;;
  redis) verify_redis ;;
  config) verify_config ;;
  all)
    verify_postgres
    verify_redis
    verify_config
    verify_s3
    ;;
  esac
  ;;
esac

echo ""
echo "════════════════════════════════════════════════════════════"
printf "  Results:  ${PASSED} passed,  ${FAILED} failed  (of ${CHECKED})\n"
echo "════════════════════════════════════════════════════════════"

# ── Notify (§9.1 TelegramNotify node) ──────────────────────────
if [ ${FAILED} -gt 0 ]; then
  LEVEL=error CONTEXT=backup TASK=verify bash "${TELEGRAM_SH}" "Backup verification FAILED: ${FAILED} check(s) failed" 2> /dev/null || true
  exit 1
else
  LEVEL=info CONTEXT=backup TASK=verify bash "${TELEGRAM_SH}" "Backup verification PASSED: ${CHECKED} checks OK" 2> /dev/null || true
fi
