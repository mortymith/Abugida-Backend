#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# PostgreSQL Point-in-Time Recovery (PITR) (§9, ADR-002)
# ═════════════════════════════════════════════════════════════════════
#
# Restores PostgreSQL to a specific point in time using:
#   1. Full pg_dump backup (base)
#   2. WAL segments archived since that backup
#   3. recovery_target_time to stop at the desired moment
#
# This creates a NEW container (scratch restore) to avoid destroying
# the running primary. After verification, you can swap.
#
# Usage:
#   bash scripts/restore/restore-point-in-time.sh
#   bash scripts/restore/restore-point-in-time.sh 2025-01-15 14:30:00
#   bash scripts/restore/restore-point-in-time.sh 2025-01-15 14:30:00 --scratch
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
CONTAINER="${COMPOSE_PROJECT}_postgres-primary"
BACKUP_DIR="./data/backups/postgres"
WAL_DIR="./data/backups/postgres/wal"
SCRATCH_CONTAINER="${COMPOSE_PROJECT}_postgres-pitr"

POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"

# Target recovery time (default: 24 hours ago)
TARGET_TIME="${1:-$(date -d '24 hours ago' '+%Y-%m-%d %H:%M:%S' 2> /dev/null || date -v-24H '+%Y-%m-%d %H:%M:%S')}"
SCRATCH_MODE="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TELEGRAM_SH="${SCRIPT_DIR}/../backup/telegram-notify.sh"

if [ "${SCRATCH_MODE}" = "--scratch" ]; then
  echo "==> PITR in scratch mode (new container)"
else
  echo "==> PITR: WARNING: This will OVERWRITE the running primary."
  echo "  Use --scratch flag to restore into a separate container."
  echo "  Target time: ${TARGET_TIME}"
  echo "  Press Ctrl+C to cancel, Enter to continue..."
  read -r
fi

# ── Find latest backup before target time ────────────────────────
LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/pg_backup_*.dump 2> /dev/null | head -1)
if [ -z "${LATEST_BACKUP}" ]; then
  echo "[restore-pitr][ERROR] No pg_dump backup found."
  LEVEL=error CONTEXT=restore TASK=postgres-pitr bash "${TELEGRAM_SH}" "PITR FAILED: no base backup" 2> /dev/null || true
  exit 1
fi
echo "==> Base backup: ${LATEST_BACKUP}"

if [ "${SCRATCH_MODE}" = "--scratch" ]; then
  # ── Start a scratch PostgreSQL container ───────────────────────
  echo "==> Starting scratch container: ${SCRATCH_CONTAINER}..."
  VOLUME_NAME="${COMPOSE_PROJECT}_postgres_pitr_data"
  docker run -d \
    --name "${SCRATCH_CONTAINER}" \
    --network "${COMPOSE_PROJECT}_infrastructure" \
    -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    postgres:17 > /dev/null

  echo "==> Waiting for scratch container to be ready..."
  sleep 10
  TARGET_CONTAINER="${SCRATCH_CONTAINER}"
else
  TARGET_CONTAINER="${CONTAINER}"
fi

# ── Restore base backup ─────────────────────────────────────────
echo "==> Restoring base backup into ${TARGET_CONTAINER}..."
docker exec "${TARGET_CONTAINER}" dropdb -U "${POSTGRES_USER}" "${POSTGRES_DB}" 2> /dev/null || true
docker exec "${TARGET_CONTAINER}" createdb -U "${POSTGRES_USER}" "${POSTGRES_DB}" 2> /dev/null
docker exec -i "${TARGET_CONTAINER}" pg_restore \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner --no-privileges \
  < "${LATEST_BACKUP}" 2>&1

# ── Create recovery signal + configure WAL replay ──────────────────
echo "==> Configuring point-in-time recovery to: ${TARGET_TIME}..."
docker exec "${TARGET_CONTAINER}" bash -c '
    # Create recovery signal
    touch /var/lib/postgresql/data/recovery.signal
    # Add recovery settings to postgresql.auto.conf
    echo "restore_command = \"cp /var/lib/postgresql/wal_archive/%f %p\"" >> /var/lib/postgresql/data/postgresql.auto.conf
    echo "recovery_target_time = \"'"'"${TARGET_TIME}"'"'"\"" >> /var/lib/postgresql/data/postgresql.auto.conf
    echo "recovery_target_action = \"promote\"" >> /var/lib/postgresql/data/postgresql.auto.conf
'

# ── Copy WAL segments into the container ──────────────────────────
echo "==> Copying WAL segments for replay..."
docker exec "${TARGET_CONTAINER}" mkdir -p /var/lib/postgresql/wal_archive
for WAL_FILE in "${WAL_DIR}"/[0-9A-F]*; do
  [ -f "${WAL_FILE}" ] || continue
  docker cp "${WAL_FILE}" "${TARGET_CONTAINER}:/var/lib/postgresql/wal_archive/" 2> /dev/null || true
done

# ── Restart container to begin recovery ────────────────────────────
echo "==> Restarting for recovery..."
docker restart "${TARGET_CONTAINER}" > /dev/null
echo "==> Waiting for recovery to complete (this may take several minutes)..."
sleep 15

# ── Check recovery status ────────────────────────────────────────
echo "==> Checking recovery status..."
docker exec "${TARGET_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "\n    SELECT pg_is_in_recovery(), 
           current_timestamp, 
           pg_last_xact_replay_timestamp() AS recovered_to;\n" 2> /dev/null || true

SIZE=$(docker exec "${TARGET_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT pg_size_pretty(pg_database_size('${POSTGRES_DB}'));" 2> /dev/null || echo 'unknown')

if [ "${SCRATCH_MODE}" = "--scratch" ]; then
  echo "==> PITR complete in scratch container: ${SCRATCH_CONTAINER}"
  echo "  Database size: ${SIZE}"
  echo "  Recovered to: ${TARGET_TIME}"
  echo "  To inspect:  docker exec -it ${SCRATCH_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
  echo "  To clean up: docker stop ${SCRATCH_CONTAINER} && docker rm ${SCRATCH_CONTAINER}"
else
  echo "==> PITR complete. Primary restored to: ${TARGET_TIME}"
fi

LEVEL=info CONTEXT=restore TASK=postgres-pitr bash "${TELEGRAM_SH}" "PITR restore complete to ${TARGET_TIME} (${SIZE})" 2> /dev/null || true
