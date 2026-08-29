#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Comprehensive Service Health Check
# Source: deployment.md v3.0.0
#
# Checks all infrastructure services and reports status.
# Exit codes: 0 = all healthy, 1 = some degraded, 2 = critical failure.
#
# Usage:
#   bash scripts/monitoring/check-all-services.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"

# ─── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

HEALTHY=0
DEGRADED=0
CRITICAL=0

check_docker_health() {
  local name="$1"
  local container="${COMPOSE_PROJECT}_${name}"
  local status

  status=$(docker inspect --format="{{.State.Health.Status}}" "${container}" 2> /dev/null || echo "missing")

  case "${status}" in
  healthy)
    printf "  ${GREEN}healthy${RESET}  %-30s\n" "${name}"
    ;;
  unhealthy)
    printf "  ${RED}UNHEALTHY %-30s${RESET}\n" "${name}"
    CRITICAL=$((CRITICAL + 1))
    ;;
  starting)
    printf "  ${YELLOW}starting  %-30s${RESET}\n" "${name}"
    DEGRADED=$((DEGRADED + 1))
    ;;
  missing)
    printf "  ${YELLOW}missing   %-30s${RESET}\n" "${name}"
    ;;
  esac
}

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Service Health Check${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# Core services (both dev and prod)
for svc in postgres-primary pgbouncer redis-primary minio api dashboard marketing; do
  check_docker_health "${svc}"
done

# Prod-only services
echo ""
echo "  -- Prod-only Services --"
for svc in postgres-replica-1 postgres-replica-2 redis-replica-1 redis-replica-2 redis-sentinel-1 redis-sentinel-2 redis-sentinel-3 vault minio-backup; do
  check_docker_health "${svc}"
done

echo ""
echo -e "${BOLD}Summary:${RESET}  Healthy: ${GREEN}${HEALTHY}${RESET}  Degraded: ${YELLOW}${DEGRADED}${RESET}  Critical: ${RED}${CRITICAL}${RESET}"

if [ "${CRITICAL}" -gt 0 ]; then
  exit 2
elif [ "${DEGRADED}" -gt 0 ]; then
  exit 1
fi
exit 0
