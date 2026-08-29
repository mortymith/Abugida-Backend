#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# System Diagnostics
# Source: deployment.md v3.0.0
#
# Collects and displays comprehensive system health information:
#   - Docker engine status & version
#   - Container states (running, exited, restarting)
#   - Network connectivity between tiers
#   - Volume usage
#   - Resource utilization
#
# Usage:
#   bash scripts/monitoring/diagnostics.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"

# ─── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Infrastructure Diagnostics${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# ─── Docker Engine ─────────────────────────────────────────────────────
echo -e "${BOLD}Docker Engine${RESET}"
echo "  Version: $(docker version --format '{{.Server.Version}}' 2> /dev/null || echo 'N/A')"
echo "  Containers: $(docker ps -a --filter "name=${COMPOSE_PROJECT}" --format '{{.Names}}' | wc -l)"
echo "  Running:   $(docker ps --filter "name=${COMPOSE_PROJECT}" --format '{{.Names}}' | wc -l)"
echo ""

# ─── Container States ──────────────────────────────────────────────────
echo -e "${BOLD}Container States${RESET}"
printf "  ${BOLD}%-40s %-12s %-10s %s${RESET}\n" "Name" "Status" "Health" "Ports"
echo "  ──────────────────────────────────────────────────────────"

docker ps -a --filter "name=${COMPOSE_PROJECT}" --format '{{.Names}}    {{.Status}}     {{.Ports}}' 2> /dev/null | while IFS=$'\t' read -r name status ports; do
  # Extract health status if available
  HEALTH=$(docker inspect --format="{{.State.Health.Status}}" "${name}" 2> /dev/null || echo "n/a")

  # Color code
  case "${HEALTH}" in
  healthy) HC="${GREEN}healthy${RESET}" ;;
  unhealthy) HC="${RED}unhealthy${RESET}" ;;
  *) HC="${YELLOW}${HEALTH}${RESET}" ;;
  esac

  printf "  %-40s %-12s %s     %s\n" "${name}" "${status}" "${HC}" "${ports}"
done
echo ""

# ─── Network Connectivity ─────────────────────────────────────────────
echo -e "${BOLD}Networks (Docker)${RESET}"
docker network ls --filter "name=${COMPOSE_PROJECT}" --format "  {{.Name}}\t{{.Driver}}\t{{.Scope}}" 2> /dev/null || echo "  (no networks found)"
echo ""

# ─── Volume Usage ─────────────────────────────────────────────────────
echo -e "${BOLD}Volume Usage${RESET}"
docker volume ls --filter "name=${COMPOSE_PROJECT}" --format '{{.Name}}' 2> /dev/null | while read -r vol; do
  SIZE=$(docker system df -v 2> /dev/null | grep "${vol}" | awk '{print $3}' || echo "?")
  printf "  %-50s %s\n" "${vol}" "${SIZE}"
done
echo ""

# ─── Resource Utilization ─────────────────────────────────────────────
echo -e "${BOLD}Resource Utilization${RESET}"
docker stats --no-stream --filter "name=${COMPOSE_PROJECT}" \
  --format "  {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2> /dev/null ||
  echo "  (no running containers)"
echo ""

# ─── Host Resources ──────────────────────────────────────────────────
echo -e "${BOLD}Host Resources${RESET}"
echo "  Disk:  $(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo "  Memory: $(free -h | awk '/^Mem:/{print $3 "/" $2}')"
echo "  Uptime: $(uptime -p 2> /dev/null || uptime)"
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
