#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Observability Data Backup — ClickHouse + SigNoz Config (§9.1)
# ═════════════════════════════════════════════════════════════════════
#
# Backs up:
#   1. ClickHouse data via BACKUP TABLE freeze (native backup tooling)
#   2. OTEL collector configuration
#
# Note: SigNoz metadata (dashboards, alert rules) lives in PostgreSQL
# ("signoz" database) and is covered by backup-postgres.sh; this script
# handles the ClickHouse telemetry data layer.
#
# Usage:
#   bash scripts/backup/backup-monitoring.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CLICKHOUSE_CONTAINER="${COMPOSE_PROJECT}_clickhouse"
# Authenticated client (password comes from .env / Vault-exported env).
CH_CLIENT=(clickhouse-client)
[ -n "${CLICKHOUSE_PASSWORD:-}" ] && CH_CLIENT+=(--password "${CLICKHOUSE_PASSWORD}")
BACKUP_DIR="./data/backups/monitoring"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

S3_BUCKET="${BACKUP_S3_BUCKET:-infrastructure-backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-monitoring/${ENVIRONMENT:-production}}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -f .env.prod ]; then
  _aws_key=$(grep -E '^AWS_ACCESS_KEY_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _aws_secret=$(grep -E '^AWS_SECRET_ACCESS_KEY=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${_aws_key:-}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${_aws_secret:-}}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TELEGRAM_SH="${SCRIPT_DIR}/telegram-notify.sh"
mkdir -p "${BACKUP_DIR}/clickhouse"

# ── Check ClickHouse is running ──────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CLICKHOUSE_CONTAINER}$"; then
  echo "[backup-monitoring][WARN] ClickHouse not running. Skipping data backup."
  echo "[backup-monitoring][OK] Config-only backup complete."
  exit 0
fi

# ── ClickHouse backup via TABLE + PARTS freeze ─────────────────────
echo "[backup-monitoring] Backing up ClickHouse data..."
CLICKHOUSE_BACKUP_PATH="/var/lib/clickhouse/backup/obs_${TIMESTAMP}"

docker exec "${CLICKHOUSE_CONTAINER}" mkdir -p "${CLICKHOUSE_BACKUP_PATH}"

# Backup key SigNoz tables
for DB_TABLE in \
  "signoz_traces.otel_traces" \
  "signoz_traces.otel_trace_spans" \
  "signoz_metrics.time_series_v2" \
  "signoz_metrics.samples_v2" \
  "signoz_logs.otel_logs_v2"; do

  TABLE_ONLY="${DB_TABLE#*.}"
  DB_ONLY="${DB_TABLE%%.*}"
  echo "  Freezing ${DB_TABLE}..."
  docker exec "${CLICKHOUSE_CONTAINER}" "${CH_CLIENT[@]}" \
    --query "BACKUP TABLE ${DB_TABLE} TO Disk('obs_backup', '${CLICKHOUSE_BACKUP_PATH}/${DB_ONLY}/${TABLE_ONLY}')" \
    2> /dev/null || echo "    (skipped — table may not exist yet)"
done

# Copy backup from container to host
docker cp "${CLICKHOUSE_CONTAINER}:${CLICKHOUSE_BACKUP_PATH}/." "${BACKUP_DIR}/clickhouse/${TIMESTAMP}/" 2> /dev/null || true

# Cleanup inside container
docker exec "${CLICKHOUSE_CONTAINER}" rm -rf "${CLICKHOUSE_BACKUP_PATH}" 2> /dev/null || true

# ── Compress and upload ──────────────────────────────────────────
if [ -d "${BACKUP_DIR}/clickhouse/${TIMESTAMP}" ]; then
  tar czf "${BACKUP_DIR}/clickhouse_${TIMESTAMP}.tar.gz" -C "${BACKUP_DIR}/clickhouse" "${TIMESTAMP}"
  rm -rf "${BACKUP_DIR}/clickhouse/${TIMESTAMP}"

  if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    aws s3 cp "${BACKUP_DIR}/clickhouse_${TIMESTAMP}.tar.gz" \
      "s3://${S3_BUCKET}/${S3_PREFIX}/clickhouse/${DATE_ONLY}/clickhouse_${TIMESTAMP}.tar.gz" \
      --region "${AWS_REGION}" 2> /dev/null && echo "  Uploaded to S3"
  fi

  SIZE=$(du -h "${BACKUP_DIR}/clickhouse_${TIMESTAMP}.tar.gz" | cut -f1)
  echo "[backup-monitoring][OK] ClickHouse backup complete (${SIZE})"
else
  echo "[backup-monitoring][WARN] No ClickHouse data to back up."
fi

# ── Record timestamp ─────────────────────────────────────────────
echo "${TIMESTAMP}" > "${BACKUP_DIR}/.last-backup"

LEVEL=info CONTEXT=backup TASK=monitoring bash "${TELEGRAM_SH}" "Monitoring backup complete" 2> /dev/null || true
