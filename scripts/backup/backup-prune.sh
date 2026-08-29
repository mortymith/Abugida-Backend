#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Backup Prune — Remove Old Backups
# Source: deployment.md v3.0.0
#
# Removes backup files older than BACKUP_RETENTION_DAYS (from .env).
# Defaults to 30 days if not set.
#
# Usage:
#   bash scripts/backup/backup-prune.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# Load retention from .env if available
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

BACKUP_BASE="./data/backups"
PRUNED=0

for BACKUP_TYPE in postgres redis minio; do
  DIR="${BACKUP_BASE}/${BACKUP_TYPE}"
  if [ ! -d "${DIR}" ]; then
    continue
  fi

  # Find and remove files older than retention
  COUNT=$(find "${DIR}" -type f -mtime "+${RETENTION_DAYS}" 2> /dev/null | wc -l)
  if [ "${COUNT}" -gt 0 ]; then
    find "${DIR}" -type f -mtime "+${RETENTION_DAYS}" -print -delete 2> /dev/null
    PRUNED=$((PRUNED + COUNT))
    echo "[backup-prune] Removed ${COUNT} old file(s) from ${BACKUP_TYPE}/"
  fi
done

if [ "${PRUNED}" -eq 0 ]; then
  echo "[backup-prune] No files to prune (retention: ${RETENTION_DAYS} days)."
else
  echo "[backup-prune][OK] Pruned ${PRUNED} file(s) older than ${RETENTION_DAYS} days."
fi
