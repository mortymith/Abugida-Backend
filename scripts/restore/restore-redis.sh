#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Redis Restore
# Source: deployment.md v3.0.0, ADR-014
#
# Restores Redis from an RDB backup file (gzipped or raw).
# Stops the container, replaces the RDB, and restarts.
#
# Usage:
#   bash scripts/restore/restore-redis.sh
#   bash scripts/restore/restore-redis.sh ./data/backups/redis/redis_20250101_120000.rdb.gz
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CONTAINER="${COMPOSE_PROJECT}_redis-primary"
BACKUP_DIR="./data/backups/redis"
COMPOSE_CMD="docker compose --project-directory . -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/profiles/dev.override.yml"

BACKUP_FILE="${1:-}"

# ── Logging ───────────────────────────────────────────────────────
log_info() { echo "[restore-redis] $*"; }
log_ok() { echo "[restore-redis][OK] $*"; }
log_err() { echo "[restore-redis][ERROR] $*" >&2; }

# ── Find latest backup if not specified ────────────────────────────
if [ -z "${BACKUP_FILE}" ]; then
  # Match actual backup filenames: redis_YYYYMMDD_HHMMSS.rdb.gz
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/redis_*.rdb.gz 2> /dev/null | head -1)
  if [ -z "${BACKUP_FILE}" ]; then
    # Fallback: uncompressed RDB
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/redis_*.rdb 2> /dev/null | head -1)
  fi
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

# ── Decompress if gzipped ─────────────────────────────────────────
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  TEMP_RDB="$(mktemp /tmp/redis_restore_XXXXXX.rdb)"
  trap 'rm -f "${TEMP_RDB}"' EXIT
  log_info "Decompressing ${BACKUP_FILE}..."
  gunzip -c "${BACKUP_FILE}" > "${TEMP_RDB}"
  HOST_RDB_PATH="${TEMP_RDB}"
else
  HOST_RDB_PATH="${BACKUP_FILE}"
fi

# ── Confirm restore ───────────────────────────────────────────────
log_info "WARNING: This will replace all Redis data."
echo "  Backup: ${BACKUP_FILE}"
echo "  Press Ctrl+C to cancel, Enter to continue..."
read -r

# ── Stop container ───────────────────────────────────────────────
log_info "Stopping redis-primary..."
docker stop "${CONTAINER}" > /dev/null

# ── Copy RDB to volume via temp container ──────────────────────────
VOLUME_NAME="${COMPOSE_PROJECT}_redis_primary_data"

log_info "Copying RDB to volume..."
docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "$(pwd):/host" \
  alpine sh -c "cp /host/${HOST_RDB_PATH} /data/dump.rdb && chmod 640 /data/dump.rdb"

# ── Restart ────────────────────────────────────────────────────────
log_info "Starting redis-primary..."
${COMPOSE_CMD} up -d redis-primary

log_ok "Restore complete. Redis is starting with restored data."
