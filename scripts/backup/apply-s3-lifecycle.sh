#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# S3 Lifecycle Policy Application (§9.1 Storage Tiers)
# ═════════════════════════════════════════════════════════════════════
#
# Applies the lifecycle policy defined in s3-lifecycle/lifecycle-policy.json
# to the backup bucket. This encodes the tiering diagram:
#   0-30d:   S3 Standard
#   30-90d:  S3 Infrequent Access
#   90-365d: Glacier Deep Archive
#   365d+:   Expired (deleted)
#
# Usage:
#   bash scripts/backup/apply-s3-lifecycle.sh
#   bash scripts/backup/apply-s3-lifecycle.sh --dry-run
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
S3_BUCKET="${BACKUP_S3_BUCKET:-infrastructure-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
POLICY_FILE="${SCRIPT_DIR}/s3-lifecycle/lifecycle-policy.json"

if [ -f .env.prod ]; then
  _aws_key=$(grep -E '^AWS_ACCESS_KEY_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _aws_secret=$(grep -E '^AWS_SECRET_ACCESS_KEY=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${_aws_key:-}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${_aws_secret:-}}"
fi

if ! command -v aws &> /dev/null; then
  echo "[s3-lifecycle][ERROR] aws CLI not found."
  exit 1
fi

if [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  echo "[s3-lifecycle][ERROR] AWS credentials not configured."
  exit 1
fi

echo "==> Applying lifecycle policy to s3://${S3_BUCKET}..."
echo "  Policy file: ${POLICY_FILE}"

if [ "${1:-}" = "--dry-run" ]; then
  echo "==> DRY RUN — would apply:"
  cat "${POLICY_FILE}"
  echo ""
  echo "==> Current policy:"
  aws s3api get-bucket-lifecycle-configuration \
    --bucket "${S3_BUCKET}" \
    --region "${AWS_REGION}" 2> /dev/null ||
    echo "  (no existing policy)"
else
  # Ensure bucket exists
  aws s3 mb "s3://${S3_BUCKET}" --region "${AWS_REGION}" 2> /dev/null || true

  # Apply lifecycle policy
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "${S3_BUCKET}" \
    --lifecycle-configuration "file://${POLICY_FILE}" \
    --region "${AWS_REGION}" 2> /dev/null

  echo "[s3-lifecycle][OK] Lifecycle policy applied to s3://${S3_BUCKET}"
  echo "  Tiering: Standard (0-30d) → IA (30-90d) → Glacier (90-365d) → Expired (365d+)"
fi
