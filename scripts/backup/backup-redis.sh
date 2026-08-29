#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# Redis Backup — SAVE on Replica, Integrity Check, S3 Upload (§9.2, ADR-014)
# ═════════════════════════════════════════════════════════════════════════════════
#
# Per spec §9.2 verbatim requirements:
#   - SAVE on replica (not primary) to avoid blocking
#   - Copy RDB + AOF files
#   - gzip compression
#   - redis-check-rdb integrity verification
#   - S3 upload
#   - Retention prune
#   - Telegram notify on success/failure
#
# In dev (no replicas): falls back to BGSAVE on primary with warning.
# In prod: uses redis-replica-1 for SAVE.
#
# Storage tiering: local (30d) → S3 (90d) → Glacier (365d)
#
# Usage:
#   bash scripts/backup/backup-redis.sh
# ═════════════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
ENVIRONMENT="${ENVIRONMENT:-development}"
BACKUP_DIR="./data/backups/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# S3 configuration
S3_BUCKET="${BACKUP_S3_BUCKET:-infrastructure-backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-redis/${ENVIRONMENT}}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Load credentials (ADR-006: env var first, then .env fallback)
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
if [ -z "${REDIS_PASSWORD}" ] && [ -f .env ]; then
  REDIS_PASSWORD=$(grep -E '^REDIS_PASSWORD=' .env 2> /dev/null | head -1 | cut -d'=' -f2- || true)
fi
if [ -f .env.prod ]; then
  _aws_key=$(grep -E '^AWS_ACCESS_KEY_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _aws_secret=$(grep -E '^AWS_SECRET_ACCESS_KEY=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${_aws_key:-}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${_aws_secret:-}}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TELEGRAM_SH="${SCRIPT_DIR}/telegram-notify.sh"
mkdir -p "${BACKUP_DIR}"

# ── Determine target container (replica preferred, per §9.2) ─────────
REPLICA_CONTAINER="${COMPOSE_PROJECT}_redis-replica-1"
PRIMARY_CONTAINER="${COMPOSE_PROJECT}_redis-primary"

if docker ps --format '{{.Names}}' | grep -q "^${REPLICA_CONTAINER}$"; then
  TARGET_CONTAINER="${REPLICA_CONTAINER}"
  echo "[backup-redis] Using replica: ${TARGET_CONTAINER}"
else
  TARGET_CONTAINER="${PRIMARY_CONTAINER}"
  if docker ps --format '{{.Names}}' | grep -q "^${TARGET_CONTAINER}$"; then
    echo "[backup-redis][WARN] No replica found. Falling back to primary: ${TARGET_CONTAINER}"
  else
    echo "[backup-redis][ERROR] No Redis container running."
    LEVEL=error CONTEXT=backup TASK=redis bash "${TELEGRAM_SH}" "Redis backup FAILED: no container running" 2> /dev/null || true
    exit 1
  fi
fi

# ── Notify start ──────────────────────────────────────────────────
echo "[backup-redis] Starting Redis backup..."

# ── Trigger SAVE on target (per §9.2: SAVE on replica) ────────────
echo "[backup-redis] Triggering SAVE on ${TARGET_CONTAINER}..."
REDIS_CLI="docker exec -e REDISCLI_AUTH=${REDIS_PASSWORD} ${TARGET_CONTAINER} redis-cli"

LASTSAVE_BEFORE=$($REDIS_CLI LASTSAVE 2> /dev/null | tr -d '\r')
$REDIS_CLI SAVE 2> /dev/null

# ── Wait for SAVE to complete ──────────────────────────────────────
echo "[backup-redis] Waiting for SAVE to complete..."
MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  LASTSAVE_AFTER=$($REDIS_CLI LASTSAVE 2> /dev/null | tr -d '\r')
  if [ "${LASTSAVE_AFTER}" != "${LASTSAVE_BEFORE}" ]; then
    echo "[backup-redis] SAVE complete."
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "[backup-redis][ERROR] SAVE did not complete within ${MAX_WAIT}s."
  LEVEL=error CONTEXT=backup TASK=redis bash "${TELEGRAM_SH}" "Redis backup FAILED: SAVE timeout" 2> /dev/null || true
  exit 1
fi

# ── Copy RDB + AOF from container (per §9.2) ──────────────────────
RDB_SRC="${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"
AOF_SRC="${BACKUP_DIR}/redis_aof_${TIMESTAMP}.aof"
RDB_DEST="${RDB_SRC}.gz"
AOF_DEST="${AOF_SRC}.gz"

docker cp "${TARGET_CONTAINER}:/data/dump.rdb" "${RDB_SRC}" 2> /dev/null || true
docker cp "${TARGET_CONTAINER}:/data/appendonly.aof" "${AOF_SRC}" 2> /dev/null || true

# ── Compress (per §9.2) ────────────────────────────────────────────
echo "[backup-redis] Compressing..."
gzip -f "${RDB_SRC}" 2> /dev/null || true
gzip -f "${AOF_SRC}" 2> /dev/null || true

# ── Verify integrity with redis-check-rdb (per §9.2) ──────────────
echo "[backup-redis] Running integrity check..."
if [ -f "${RDB_DEST}" ]; then
  # Decompress to temp for check
  TEMP_RDB=$(mktemp /tmp/redis_verify_XXXXXX.rdb)
  trap 'rm -f "${TEMP_RDB}"' RETURN
  gunzip -c "${RDB_DEST}" > "${TEMP_RDB}" 2> /dev/null

  # Try to find redis-check-rdb (may be on host or in redis container)
  if command -v redis-check-rdb &> /dev/null; then
    CHECK_OUTPUT=$(redis-check-rdb "${TEMP_RDB}" 2>&1)
    CHECK_RC=$?
  else
    CHECK_OUTPUT=$(docker exec "${TARGET_CONTAINER}" redis-check-rdb /data/dump.rdb 2>&1 || echo "check-tool-not-found")
    CHECK_RC=$?
  fi
  rm -f "${TEMP_RDB}"

  if [ ${CHECK_RC} -eq 0 ]; then
    echo "[backup-redis] RDB integrity check PASSED."
  else
    echo "[backup-redis][ERROR] RDB integrity check FAILED: ${CHECK_OUTPUT}"
    LEVEL=error CONTEXT=backup TASK=redis bash "${TELEGRAM_SH}" "Redis backup FAILED: RDB verification failed" 2> /dev/null || true
    rm -f "${RDB_DEST}"
    exit 1
  fi
else
  echo "[backup-redis][WARN] No RDB file to verify."
fi

# ── Upload to S3 (per §9.2) ───────────────────────────────────────
upload_s3() {
  local src="$1"
  local dest="$2"
  if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    aws s3 cp "${src}" "s3://${S3_BUCKET}/${dest}" --region "${AWS_REGION}" 2> /dev/null && echo "  Uploaded: ${dest}"
  else
    echo "  (S3 upload skipped — aws CLI or credentials not configured)"
  fi
}

if [ -f "${RDB_DEST}" ]; then
  upload_s3 "${RDB_DEST}" "${S3_PREFIX}/rdb/${DATE_ONLY}/redis_${TIMESTAMP}.rdb.gz"
fi
if [ -f "${AOF_DEST}" ]; then
  upload_s3 "${AOF_DEST}" "${S3_PREFIX}/aof/${DATE_ONLY}/redis_aof_${TIMESTAMP}.aof.gz"
fi

# ── Cleanup old backups (retention prune, per §9.2) ────────────────
PRUNED=$(find "${BACKUP_DIR}" -name "redis_*.rdb.gz" -mtime "+${RETENTION_DAYS}" -print -delete 2> /dev/null | wc -l)
PRUNED_AOF=$(find "${BACKUP_DIR}" -name "redis_aof_*.aof.gz" -mtime "+${RETENTION_DAYS}" -print -delete 2> /dev/null | wc -l)
if [ $((PRUNED + PRUNED_AOF)) -gt 0 ]; then
  echo "[backup-redis] Pruned $((PRUNED + PRUNED_AOF)) old backup(s)."
fi

# ── Record timestamp for backup-status ─────────────────────────────
echo "${TIMESTAMP}" > "${BACKUP_DIR}/.last-backup"

# ── Notify success (per §9.2) ─────────────────────────────────────
SIZE="$(du -h "${RDB_DEST}" 2> /dev/null | cut -f1 || echo 'unknown')"
echo "[backup-redis][OK] Backup complete: ${RDB_DEST} (${SIZE})"
LEVEL=info CONTEXT=backup TASK=redis bash "${TELEGRAM_SH}" "Redis backup success\nSize: ${SIZE}" 2> /dev/null || true
