#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# MinIO Restore
# Source: deployment.md v3.0.0, ADR-008, ADR-012
#
# Restores MinIO bucket data from a local backup directory.
# Uses `mc mirror` to copy data back into the bucket.
#
# Usage:
#   bash scripts/restore/restore-minio.sh
#   bash scripts/restore/restore-minio.sh ./data/backups/minio/20250101_120000/
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CONTAINER="${COMPOSE_PROJECT}_minio"
BACKUP_DIR="./data/backups/minio"

MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
# ADR-006: env var first, then .env fallback
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}"
if [ -z "${MINIO_ROOT_PASSWORD}" ] && [ -f ".env" ]; then
  MINIO_ROOT_PASSWORD="$(grep -E '^MINIO_ROOT_PASSWORD=' .env 2> /dev/null | head -1 | cut -d'=' -f2- || true)"
fi
BUCKET="${MINIO_BUCKET_NAME:-app-data}"

BACKUP_PATH="${1:-}"

# ── Find latest backup if not specified ────────────────────────────
if [ -z "${BACKUP_PATH}" ]; then
  BACKUP_PATH=$(ls -dt "${BACKUP_DIR}"/*/ 2> /dev/null | head -1)
  if [ -z "${BACKUP_PATH}" ]; then
    echo "[restore-minio][ERROR] No backup directories found in ${BACKUP_DIR}"
    exit 1
  fi
  BACKUP_PATH="${BACKUP_PATH%/}"
  echo "[restore-minio] Using latest backup: ${BACKUP_PATH}"
fi

if [ ! -d "${BACKUP_PATH}" ]; then
  echo "[restore-minio][ERROR] Backup directory not found: ${BACKUP_PATH}"
  exit 1
fi

# ── Check container is running ────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[restore-minio][ERROR] Container ${CONTAINER} is not running."
  exit 1
fi

# ── Confirm restore ───────────────────────────────────────────────
echo "[restore-minio] WARNING: This will overwrite data in bucket '${BUCKET}'."
echo "  Backup: ${BACKUP_PATH}"
echo "  Press Ctrl+C to cancel, Enter to continue..."
read -r

# ── Copy backup into container and mirror ─────────────────────────
echo "[restore-minio] Restoring..."
docker cp "${BACKUP_PATH}/." "${CONTAINER}:/restore-data/" 2> /dev/null

MINIO_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CONTAINER}" 2> /dev/null)

# Use docker exec to run mc mirror inside the container
docker exec "${CONTAINER}" sh -c "
    mc alias set local http://localhost:9000 '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}' >/dev/null 2>&1 &&
    mc mirror --overwrite /restore-data/ local/${BUCKET}/ 2>/dev/null &&
    rm -rf /restore-data/
"

echo "[restore-minio][OK] Restore complete from ${BACKUP_PATH}"
