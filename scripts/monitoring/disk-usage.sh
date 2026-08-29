#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Volume & Disk Usage
# Source: deployment.md v3.0.0
#
# Shows Docker volume sizes and host disk utilization.
# Useful for capacity planning and cleanup decisions.
#
# Usage:
#   bash scripts/monitoring/disk-usage.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"

# ─── Colors ────────────────────────────────────────────────────────────
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Disk & Volume Usage${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# ─── Host Disk ────────────────────────────────────────────────────────
echo -e "${BOLD}Host Filesystem${RESET}"
df -h --type=ext4 --type=xfs --type=btrfs 2> /dev/null | head -5 || df -h . | head -5
echo ""

# ─── Docker System Overview ───────────────────────────────────────────
echo -e "${BOLD}Docker Disk Usage${RESET}"
docker system df 2> /dev/null || echo "  (docker system df not available)"
echo ""

# ─── Project Volumes ──────────────────────────────────────────────────
echo -e "${BOLD}Project Volumes (${COMPOSE_PROJECT})${RESET}"
docker volume ls --filter "name=${COMPOSE_PROJECT}" --format 'table {{.Name}}' 2> /dev/null | while read -r vol; do
  # Try to get size via docker system df -v
  INFO=$(docker system df -v 2> /dev/null | grep "${vol}" | head -1 || true)
  if [ -n "${INFO}" ]; then
    echo "  ${INFO}"
  else
    echo "  ${vol}  (size unknown)"
  fi
done
echo ""

# ─── Backup Size ──────────────────────────────────────────────────────
BACKUP_DIR="./data/backups"
if [ -d "${BACKUP_DIR}" ]; then
  echo -e "${BOLD}Backup Storage${RESET}"
  for TYPE in postgres redis minio; do
    if [ -d "${BACKUP_DIR}/${TYPE}" ]; then
      SIZE=$(du -sh "${BACKUP_DIR}/${TYPE}" 2> /dev/null | cut -f1)
      COUNT=$(find "${BACKUP_DIR}/${TYPE}" -type f 2> /dev/null | wc -l)
      echo "  ${TYPE}:  ${SIZE}  (${COUNT} files)"
    fi
  done
  echo ""
fi
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
