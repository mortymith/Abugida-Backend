#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# Pre-Flight Deployment Checks (§5.1 PreFlight node)
# ═══════════════════════════════════════════════════════════════════════════════════
#
# Validates the environment is ready for deployment:
#   1. Docker and Docker Compose versions
#   2. Required environment files (.env.prod)
#   3. Required secret environment variables (NIST-validated, length >= 20)
#   4. Dockerfiles exist
#   5. Vault is initialized and unsealed (production, §5.1 VaultCheck node)
#   6. Current deployment health (services healthy)
#   7. Sufficient disk space (>= 5GB free)
#   8. No conflicting containers on key ports
#   9. OTEL collector reachable (observability for monitoring)
#
# Usage:
#   bash scripts/deploy/pre-flight.sh
#   bash scripts/deploy/pre-flight.sh --status-only
# ═════════════════════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

STATUS_ONLY=false
if [ "${1:-}" = "--status-only" ]; then
  STATUS_ONLY=true
fi

# ─── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0
WARN=0

check_pass() {
  printf "  ${GREEN}PASS${RESET} %s\n" "$1"
  PASS=$((PASS + 1))
}
check_fail() {
  printf "  ${RED}FAIL${RESET} %s\n" "$1"
  FAIL=$((FAIL + 1))
}
check_warn() {
  printf "  ${YELLOW}WARN${RESET} %s\n" "$1"
  WARN=$((WARN + 1))
}

# ─── Status-only mode ─────────────────────────────────────────────────
if [ "${STATUS_ONLY}" = true ]; then
  echo "==> Deployment Status"
  echo ""

  COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
  echo "--- Running Containers ---"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2> /dev/null |
    grep -E "${COMPOSE_PROJECT}" || echo "  (no infra containers running)"
  echo ""

  COLOR_FILE="${SCRIPT_DIR}/.current-color"
  if [ -f "${COLOR_FILE}" ]; then
    echo "Active deployment color: $(cat "${COLOR_FILE}")"
  else
    echo "Active deployment color: (not set)"
  fi

  VERSION_FILE="${SCRIPT_DIR}/.current-version"
  if [ -f "${VERSION_FILE}" ]; then
    echo "Current version: $(cat "${VERSION_FILE}")"
  fi

  echo ""

  # Last backup timestamps
  for BT in postgres redis config monitoring; do
    TS_FILE="./data/backups/${BT}/.last-backup"
    if [ -f "${TS_FILE}" ]; then
      echo "Last ${BT} backup: $(cat "${TS_FILE}")"
    else
      echo "Last ${BT} backup: (never)"
    fi
  done
  echo ""
  exit 0
fi

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Pre-Flight Deployment Checks${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# 1. Docker
if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2> /dev/null || echo "unknown")
  check_pass "Docker ${DOCKER_VERSION}"
else
  check_fail "Docker not found"
fi

# 2. Docker Compose
if docker compose --project-directory . version &> /dev/null; then
  COMPOSE_VERSION=$(docker compose --project-directory . version --short 2> /dev/null)
  check_pass "Docker Compose ${COMPOSE_VERSION}"
else
  check_fail "Docker Compose not found"
fi

# 3. Environment file
if [ -f ".env.prod" ]; then
  check_pass ".env.prod exists"
else
  check_fail ".env.prod not found"
fi

# 3b. Load secret variables from .env.prod / .env (ADR-006) without
# clobbering values already exported in the environment.
for ENV_SRC in .env.prod .env; do
  if [ -f "${ENV_SRC}" ]; then
    while IFS='=' read -r key value; do
      [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      [ -n "${!key:-}" ] && continue
      printf -v "${key}" '%s' "${value}"
      export "${key}"
    done < <(grep -v '^[[:space:]]*#' "${ENV_SRC}" | grep -v '^[[:space:]]*$')
  fi
done

# 4. Dockerfiles
for DF in app/api/Dockerfile app/dashboard/Dockerfile app/marketing/Dockerfile docker/dockerfiles/redis/Dockerfile docker/dockerfiles/caddy/Dockerfile; do
  if [ -f "${DF}" ]; then
    check_pass "${DF} exists"
  else
    check_warn "${DF} not found"
  fi
done

# 5. Secret environment variables (ADR-006)
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
SECRETS_OK=true
for SECRET_VAR in POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD API_SECRET_KEY; do
  SECRET_VAL="${!SECRET_VAR:-}"
  if [ -n "${SECRET_VAL}" ]; then
    SIZE=${#SECRET_VAL}
    if [ "${SIZE}" -lt 20 ]; then
      check_fail "${SECRET_VAR} too short (${SIZE} characters)"
      SECRETS_OK=false
    fi
  else
    check_fail "${SECRET_VAR} not set (export from Vault or .env)"
    SECRETS_OK=false
  fi
done
if [ "${SECRETS_OK}" = true ]; then
  check_pass "All required secret variables set and sufficient length"
fi

# 6. Vault status (§5.1 VaultCheck node, production only)
if docker ps --format '{{.Names}}' | grep -q "${COMPOSE_PROJECT}_vault"; then
  VAULT_SEALED=$(docker exec "${COMPOSE_PROJECT}_vault" vault status 2> /dev/null | grep 'Seal' | awk '{print $2}' || echo 'unknown')
  if [ "${VAULT_SEALED}" = "false" ]; then
    check_pass "Vault unsealed"
  elif [ "${VAULT_SEALED}" = "true" ]; then
    check_fail "Vault is sealed — run just vault-unseal"
  else
    check_warn "Vault status unknown (${VAULT_SEALED})"
  fi
else
  check_warn "Vault not running (dev mode)"
fi

# 7. Current deployment health
API_HEALTH=$(docker exec "${COMPOSE_PROJECT}-api-1" curl -sf http://localhost:3000/health 2> /dev/null || echo '')
if [ -n "${API_HEALTH}" ]; then
  check_pass "API /health OK"
else
  check_warn "API not healthy (may not be running yet)"
fi

DASH_HEALTH=$(docker exec "${COMPOSE_PROJECT}-dashboard-1" curl -sf http://localhost:8080/health 2> /dev/null || echo '')
if [ -n "${DASH_HEALTH}" ]; then
  check_pass "Dashboard /health OK"
else
  check_warn "Dashboard not healthy (may not be running yet)"
fi

# 8. Disk space (minimum 5GB free)
FREE_SPACE=$(df --output=avail . 2> /dev/null | tail -1 | tr -d ' ')
FREE_MB=$((FREE_SPACE / 1024))
if [ "${FREE_MB}" -ge 5120 ]; then
  check_pass "Disk space: ${FREE_MB}MB free"
else
  check_warn "Disk space low: ${FREE_MB}MB free (recommend >= 5120MB)"
fi

# 9. No conflicting containers on key ports
for PORT in 5432 6432 6379 9000 3000 8080; do
  if ss -tlnp 2> /dev/null | grep -q ":${PORT} "; then
    check_warn "Port ${PORT} already in use (may conflict)"
  fi
done || true

# 10. OTEL collector reachable (for monitoring during deploy)
if docker exec "${COMPOSE_PROJECT}_otel-collector" wget -qO- http://localhost:13133 2> /dev/null | grep -q 'Server available'; then
  check_pass "OTEL collector reachable (monitoring active)"
else
  check_warn "OTEL collector not reachable (deploy monitoring will be blind)"
fi

# 11. No unresolved placeholders in config files
PLACEHOLDER_FOUND=false
for CHECK_FILE in docker/config/keepalived/keepalived.conf docker/config/cloudflared/config.yml; do
  if [ -f "${CHECK_FILE}" ]; then
    if grep -qE 'REPLACE|CHANGE_ME|PLACEHOLDER' "${CHECK_FILE}" 2> /dev/null; then
      PLACEHOLDER_FOUND=true
      check_fail "${CHECK_FILE} contains unresolved placeholder values"
    else
      check_pass "${CHECK_FILE} has no placeholders"
    fi
  else
    check_warn "${CHECK_FILE} not found"
  fi
done

# ─── Summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
printf "  ${GREEN}Passed: %d${RESET}   ${YELLOW}Warnings: %d${RESET}   ${RED}Failed: %d${RESET}\n" "$PASS" "$WARN" "$FAIL"
echo -e "${BOLD}════════════════════════════════════════════════════════════════════════════════${RESET}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Pre-flight FAILED. Fix errors before deploying.${RESET}"
  exit 1
fi

if [ "${PLACEHOLDER_FOUND}" = "true" ]; then
  echo -e "  ${RED}Pre-flight FAILED. Fix placeholders before deploying.${RESET}"
  exit 1
fi

exit 0
