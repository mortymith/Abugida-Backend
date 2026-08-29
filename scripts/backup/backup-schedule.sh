#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Backup Schedule Installer — Cron (§9.1 diagram timing)
# ═════════════════════════════════════════════════════════════════════
#
# Installs cron jobs for:
#   - Daily 02:00:  PostgreSQL full dump + WAL upload + config backup
#   - Hourly (XX:05): Redis RDB backup (prod only per §4.1)
#   - Daily 03:00:  Monitoring (ClickHouse) backup
#   - Daily 04:00:  Backup verification (checksum)
#   - Weekly Sun 05:00: Full restore test (RestoreTest node)
#   - Daily 05:30:  Local retention prune
#
# Dev is on-demand only (no cron installed per §4.1).
# Cron is only installed in production mode.
#
# Usage:
#   sudo bash scripts/backup/backup-schedule.sh install     # Install cron
#   sudo bash scripts/backup/backup-schedule.sh uninstall   # Remove cron
#   sudo bash scripts/backup/backup-schedule.sh status      # Show installed
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CRON_TAG="# INFRA-BACKUP"
CRON_USER="root"

# Redis minute offset (avoid :00 collision with other jobs)
REDIS_MINUTE=5

install() {
  if [ "${ENVIRONMENT:-development}" != "production" ]; then
    echo "[backup-schedule][INFO] Not production (ENVIRONMENT=${ENVIRONMENT:-development}). Cron not installed."
    echo "  Dev backups are on-demand per \$4.1."
    return 0
  fi

  echo "==> Installing backup cron jobs (${CRON_USER})..."

  # Remove old entries first (idempotent)
  crontab -u "${CRON_USER}" -l 2> /dev/null | grep -v "${CRON_TAG}" | crontab -u "${CRON_USER}" - 2> /dev/null || true

  # Build new crontab
  CURRENT_CRON=$(crontab -u "${CRON_USER}" -l 2> /dev/null || true)

  cat << EOF | crontab -u "${CRON_USER}" -
${CURRENT_CRON}

# ── Daily PostgreSQL full dump + WAL upload (02:00) ── ${CRON_TAG}
0 2 * * * cd ${PROJECT_ROOT} && bash scripts/backup/backup-postgres.sh >> logs/backup-postgres.log 2>&1

# ── Hourly Redis RDB backup (prod only) ── ${CRON_TAG}
${REDIS_MINUTE} * * * * cd ${PROJECT_ROOT} && bash scripts/backup/backup-redis.sh >> logs/backup-redis.log 2>&1

# ── Daily config backup (02:30) ── ${CRON_TAG}
30 2 * * * cd ${PROJECT_ROOT} && bash scripts/backup/backup-config.sh >> logs/backup-config.log 2>&1

# ── Daily monitoring/ClickHouse backup (03:00) ── ${CRON_TAG}
0 3 * * * cd ${PROJECT_ROOT} && bash scripts/backup/backup-monitoring.sh >> logs/backup-monitoring.log 2>&1

# ── Daily backup verification (04:00) ── ${CRON_TAG}
0 4 * * * cd ${PROJECT_ROOT} && bash scripts/backup/verify-backup.sh >> logs/backup-verify.log 2>&1

# ── Weekly restore test (Sunday 05:00) ── ${CRON_TAG}
0 5 * * 0 cd ${PROJECT_ROOT} && bash scripts/backup/verify-backup.sh --restore-test >> logs/backup-restore-test.log 2>&1

# ── Daily local retention prune (05:30) ── ${CRON_TAG}
30 5 * * * cd ${PROJECT_ROOT} && bash scripts/backup/backup-prune.sh >> logs/backup-prune.log 2>&1
EOF

  echo "[backup-schedule][OK] Cron jobs installed."
  status
}

uninstall() {
  echo "==> Removing backup cron jobs..."
  crontab -u "${CRON_USER}" -l 2> /dev/null | grep -v "${CRON_TAG}" | crontab -u "${CRON_USER}" - 2> /dev/null || true
  echo "[backup-schedule][OK] Cron jobs removed."
}

status() {
  echo "==> Installed backup cron jobs:"
  crontab -u "${CRON_USER}" -l 2> /dev/null | grep "${CRON_TAG}" | grep -v '^#' | while read -r LINE; do
    MINUTE=$(echo "${LINE}" | awk '{print $1}')
    HOUR=$(echo "${LINE}" | awk '{print $2}')
    DOM=$(echo "${LINE}" | awk '{print $3}')
    DOW=$(echo "${LINE}" | awk '{print $5}')
    CMD=$(echo "${LINE}" | grep -oP 'bash scripts/backup/\K[^ ]+')
    echo "  ${HOUR}:${MINUTE}  dom=${DOM}  dow=${DOW}  ${CMD}"
  done
  if ! crontab -u "${CRON_USER}" -l 2> /dev/null | grep -q "${CRON_TAG}"; then
    echo "  (no backup cron jobs installed)"
  fi
}

case "${1:-status}" in
install) install ;;
uninstall) uninstall ;;
status) status ;;
*)
  echo "Usage: $0 {install|uninstall|status}"
  exit 1
  ;;
esac
