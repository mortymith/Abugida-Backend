#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Configuration Restore (§9.1)
# ═════════════════════════════════════════════════════════════════════
#
# Restores configuration files from a backup tarball.
# Extracts to a review directory first, then optionally overwrites.
#
# Usage:
#   bash scripts/restore/restore-config.sh                       # Latest, review only
#   bash scripts/restore/restore-config.sh --apply                # Apply after review
#   bash scripts/restore/restore-config.sh 20250101_120000        # Specific backup
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="./data/backups/config"
REVIEW_DIR="./data/backups/docker/config/.review"
TIMESTAMP="${1:-}"
APPLY="${2:-}"

# ── Find latest backup if not specified ──────────────────────────
if [ -z "${TIMESTAMP}" ]; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/config_*.tar.gz 2> /dev/null | head -1)
else
  BACKUP_FILE="${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"
fi

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "[restore-config][ERROR] Backup not found."
  exit 1
fi

echo "==> Config backup: ${BACKUP_FILE}"

# ── Verify checksum if available ───────────────────────────────
if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "==> Verifying checksum..."
  if sha256sum -c "${BACKUP_FILE}.sha256" --quiet 2> /dev/null; then
    echo "  Checksum OK"
  else
    echo "[restore-config][ERROR] Checksum mismatch!"
    exit 1
  fi
fi

# ── Extract to review directory ────────────────────────────────
echo "==> Extracting to ${REVIEW_DIR}/..."
rm -rf "${REVIEW_DIR}"
mkdir -p "${REVIEW_DIR}"
tar xzf "${BACKUP_FILE}" -C "${REVIEW_DIR}"

echo "==> Extracted contents:"
find "${REVIEW_DIR}" -type f | head -30
TOTAL=$(find "${REVIEW_DIR}" -type f | wc -l)
echo "  Total: ${TOTAL} files"

if [ "${APPLY}" = "--apply" ]; then
  echo ""
  echo "==> Applying configuration (overwriting current files)..."
  echo "  Press Ctrl+C to cancel, Enter to continue..."
  read -r

  # Copy docker/config/
  cp -r "${REVIEW_DIR}/docker/config/"* ./docker/config/ 2> /dev/null
  # Copy Dockerfiles
  cp -r "${REVIEW_DIR}/docker/dockerfiles/"* ./docker/dockerfiles/ 2> /dev/null
  # Copy compose files
  cp -r "${REVIEW_DIR}/docker/compose/"* ./docker/compose/ 2> /dev/null
  # Copy justfile
  cp "${REVIEW_DIR}/justfile" ./justfile 2> /dev/null
  # Copy scripts (but not backup scripts — those are what we're using)
  # Copy minio policies
  cp -r "${REVIEW_DIR}/docker/config/minio/policies/"* ./docker/config/minio/policies/ 2> /dev/null

  echo "[restore-config][OK] Configuration restored."
  echo "  Note: You should restart services to pick up changes."
  echo "  just down-prod && just up-prod"
else
  echo ""
  echo "==> Review mode. Files extracted to ${REVIEW_DIR}/"
  echo "  To apply: bash scripts/restore/restore-config.sh ${TIMESTAMP} --apply"
fi
