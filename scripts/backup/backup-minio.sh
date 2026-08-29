#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════
# MinIO Backup
# Source: deployment.md v3.0.0, ADR-008, ADR-012
#
# Uses `mc mirror` to sync bucket data to a local backup directory.
# In production, CRR (cross-region replication) handles remote backup;
# this script provides a local snapshot for disaster recovery.
#
# 2.2 Fix: Mirror failures are no longer silently ignored.
# Added checksum verification, minimum size check, and Telegram notification.
#
# Usage:
#   bash scripts/backup/backup-minio.sh
# ═════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CONTAINER="${COMPOSE_PROJECT}_minio"
BACKUP_DIR="./data/backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MINIMUM_BACKUP_SIZE=1024 # 1KB minimum — anything smaller is likely empty/corrupt
TELEGRAM_SH="./scripts/backup/telegram-notify.sh"

MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
# ADR-006: env var first, then .env fallback
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}"
if [ -z "${MINIO_ROOT_PASSWORD}" ] && [ -f ".env" ]; then
  MINIO_ROOT_PASSWORD="$(grep -E '^MINIO_ROOT_PASSWORD=' .env 2> /dev/null | head -1 | cut -d'=' -f2- || true)"
fi
BUCKET="${MINIO_BUCKET_NAME:-app-data}"

# ── Create backup directory ───────────────────────────────────────
mkdir -p "${BACKUP_DIR}/${TIMESTAMP}"

# ── Check container is running ────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[backup-minio][ERROR] Container ${CONTAINER} is not running."
  LEVEL=error CONTEXT=backup TASK=backup-minio bash "${TELEGRAM_SH}" "MinIO backup FAILED: container ${CONTAINER} not running." 2> /dev/null || true
  exit 1
fi

# ── Get MinIO endpoint from container network ────────────────────
MINIO_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CONTAINER}" 2> /dev/null)
MINIO_ENDPOINT="http://${MINIO_IP}:9000"

# ── Configure mc and mirror ──────────────────────────────────────
echo "[backup-minio] Backing up s3://${BUCKET} to ${BACKUP_DIR}/${TIMESTAMP}/..."

docker exec "${CONTAINER}" mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null 2>&1

# 2.2 Fix: Do not silence errors — fail on mirror failure
if ! docker exec "${CONTAINER}" mc mirror local/${BUCKET} /backup-data/ 2>&1; then
  echo "[backup-minio][ERROR] mc mirror failed."
  LEVEL=error CONTEXT=backup TASK=backup-minio bash "${TELEGRAM_SH}" "MinIO backup FAILED: mc mirror error." 2> /dev/null || true
  exit 1
fi

# ── Copy from container to host ──────────────────────────────────
docker cp "${CONTAINER}:/backup-data/." "${BACKUP_DIR}/${TIMESTAMP}/"

# ── Cleanup container backup dir ──────────────────────────────────
docker exec "${CONTAINER}" rm -rf /backup-data/ 2> /dev/null || true

# ── Verify backup (2.2/3.11: minimum size + checksum) ────────────────
BACKUP_SIZE_BYTES=$(du -sb "${BACKUP_DIR}/${TIMESTAMP}" | cut -f1)
if [ "${BACKUP_SIZE_BYTES}" -lt "${MINIMUM_BACKUP_SIZE}" ]; then
  echo "[backup-minio][ERROR] Backup is suspiciously small (${BACKUP_SIZE_BYTES} bytes). Likely empty or corrupt."
  rm -rf "${BACKUP_DIR}/${TIMESTAMP}"
  LEVEL=error CONTEXT=backup TASK=backup-minio bash "${TELEGRAM_SH}" "MinIO backup FAILED: backup too small (${BACKUP_SIZE_BYTES}B)." 2> /dev/null || true
  exit 1
fi

# Generate checksum
CHECKSUM_FILE="${BACKUP_DIR}/${TIMESTAMP}/.checksum"
find "${BACKUP_DIR}/${TIMESTAMP}" -type f -not -name '.checksum' -exec sha256sum {} \; > "${CHECKSUM_FILE}"
CHECKSUM_COUNT=$(wc -l < "${CHECKSUM_FILE}")

SIZE=$(du -sh "${BACKUP_DIR}/${TIMESTAMP}" | cut -f1)
echo "[backup-minio][OK] Backup complete: ${BACKUP_DIR}/${TIMESTAMP}/ (${SIZE}, ${CHECKSUM_COUNT} files verified)"

# Save timestamp
echo "$(date -Iseconds)" > "${BACKUP_DIR}/.last-backup"
