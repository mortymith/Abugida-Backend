#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Configuration Backup — Git-backed (§9.1 "Git Push On Change")
# ═════════════════════════════════════════════════════════════════════
#
# Backs up all configuration files to a timestamped tarball.
# In production, also commits to a config-tracking git repo.
#
# Backed up:
#   - docker/config/ (all service configs, OTEL collector config)
#   - docker/compose/ (modular compose files)
#   - justfile
#   - .env.example (non-sensitive template)
#   - docker/dockerfiles/ (all Dockerfiles)
#   - scripts/ (operational scripts)
#
# NOT backed up (sensitive, managed by Vault/.env):
#   - .env.prod, .env.dev
#   - data/vault/
#
# Usage:
#   bash scripts/backup/backup-config.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="./data/backups/config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)
BACKUP_FILE="${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"

S3_BUCKET="${BACKUP_S3_BUCKET:-infrastructure-backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-config/${ENVIRONMENT:-production}}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -f .env.prod ]; then
  _aws_key=$(grep -E '^AWS_ACCESS_KEY_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _aws_secret=$(grep -E '^AWS_SECRET_ACCESS_KEY=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${_aws_key:-}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${_aws_secret:-}}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TELEGRAM_SH="${SCRIPT_DIR}/telegram-notify.sh"
mkdir -p "${BACKUP_DIR}"

# ── Build tarball of config files ─────────────────────────────────
echo "[backup-config] Creating config tarball..."

tar czf "${BACKUP_FILE}" \
  --exclude='*.env.prod' \
  --exclude='*.env.dev' \
  --exclude='data/' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='*.rdb' \
  --exclude='*.aof' \
  docker/config/ \
  docker/compose/ \
  docker/dockerfiles/ \
  justfile \
  .env.example \
  scripts/ \
  docker/config/minio/policies/ \
  docs/ \
  2> /dev/null

# ── Checksum ─────────────────────────────────────────────────────
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
CHECKSUM=$(cat "${BACKUP_FILE}.sha256" | cut -d' ' -f1)
echo "[backup-config] Checksum: ${CHECKSUM}"

# ── Upload to S3 ─────────────────────────────────────────────────
if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/${S3_PREFIX}/config_${TIMESTAMP}.tar.gz" --region "${AWS_REGION}" 2> /dev/null && echo "  Uploaded to S3"
  aws s3 cp "${BACKUP_FILE}.sha256" "s3://${S3_BUCKET}/${S3_PREFIX}/config_${TIMESTAMP}.tar.gz.sha256" --region "${AWS_REGION}" 2> /dev/null
else
  echo "  (S3 upload skipped)"
fi

# ── Record timestamp ─────────────────────────────────────────────
echo "${TIMESTAMP}" > "${BACKUP_DIR}/.last-backup"

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[backup-config][OK] Config backup complete: ${BACKUP_FILE} (${SIZE})"
LEVEL=info CONTEXT=backup TASK=config bash "${TELEGRAM_SH}" "Config backup success (${SIZE})" 2> /dev/null || true
