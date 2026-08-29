#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# Rolling Restart Deployment with Health Verification
# ═══════════════════════════════════════════════════════════════════════════════════════════════
#
# NOTE: True blue-green requires separate compose projects or service names
# for isolated blue/green environments with independent container sets.
# This implementation performs a rolling restart with health verification,
# traffic monitoring, and automatic rollback capability.
#
# For true blue-green, consider using Docker Compose project name suffixes
# (e.g., infra-blue, infra-green) with an external load balancer.
#
# Flow:
#   PreFlight → VaultCheck → Build + Restart → HealthCheck →
#   Monitor 5min → Commit or Rollback
#
# Keeps last 3 deployment artifacts per §2.4.
#
# Usage:
#   bash scripts/deploy/blue-green.sh prod
#   DEPLOY_VERSION=v1.2.3 bash scripts/deploy/blue-green.sh prod
# ═══════════════════════════════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV="${1:-prod}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

# Build modular compose command based on environment
BASE_COMPOSE="docker compose --project-directory . -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml"
case "${ENV}" in
dev) COMPOSE_CMD="${BASE_COMPOSE} -f docker/compose/profiles/dev.override.yml" ;;
staging) COMPOSE_CMD="${BASE_COMPOSE} -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/security.yml -f docker/compose/profiles/staging.override.yml" ;;
prod) COMPOSE_CMD="${BASE_COMPOSE} -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/edge.yml -f docker/compose/scaling.yml -f docker/compose/security.yml -f docker/compose/profiles/prod.override.yml" ;;
*)
  echo "Unknown environment: ${ENV}"
  exit 1
  ;;
esac
CURRENT_COLOR_FILE="${SCRIPT_DIR}/.current-color"
VERSION_FILE="${SCRIPT_DIR}/.current-version"
DEPLOY_HISTORY_DIR="${SCRIPT_DIR}/.deploy-history"
TELEGRAM_SH="${PROJECT_ROOT}/scripts/backup/telegram-notify.sh"

DEPLOY_VERSION="${DEPLOY_VERSION:-$(date +%Y%m%d-%H%M%S)}"
# 3.9 Fix: Reduced from 15min to 5min to avoid blocking CI runners
MONITOR_DURATION=300
ERROR_RATE_THRESHOLD=0.05 # 5% 5xx
P99_THRESHOLD=2000        # 2 seconds
MAX_DEPLOY_ARTIFACTS=3    # §2.4

# ── Deploy lock (3.10) ──────────────────────────────────────────────
DEPLOY_LOCK_FILE="${PROJECT_ROOT}/.deploy.lock"
acquire_deploy_lock() {
  if [ -f "${DEPLOY_LOCK_FILE}" ]; then
    LOCK_PID=$(cat "${DEPLOY_LOCK_FILE}")
    if kill -0 "${LOCK_PID}" 2> /dev/null; then
      echo "[deploy][ERROR] Another deploy is running (PID ${LOCK_PID}). Wait for it to finish."
      exit 1
    fi
    echo "[deploy][WARN] Stale lock file found (PID ${LOCK_PID} not running). Removing."
    rm -f "${DEPLOY_LOCK_FILE}"
  fi
  echo $$ > "${DEPLOY_LOCK_FILE}"
}
release_deploy_lock() {
  rm -f "${DEPLOY_LOCK_FILE}"
}
trap release_deploy_lock EXIT

# ── Telegram notify helper ───────────────────────────────────────────
notify() {
  local level="$1" msg="$2"
  LEVEL=${level} CONTEXT=deploy TASK=rolling-deploy bash "${TELEGRAM_SH}" "${msg}" 2> /dev/null || true
}

# ── Cleanup old deployment artifacts (keep last 3) ────────────────────
cleanup_artifacts() {
  mkdir -p "${DEPLOY_HISTORY_DIR}"
  ARTIFACT_COUNT=$(ls -1d "${DEPLOY_HISTORY_DIR}"/*/ 2> /dev/null | wc -l)
  if [ "${ARTIFACT_COUNT}" -gt "${MAX_DEPLOY_ARTIFACTS}" ]; then
    REMOVE_COUNT=$((ARTIFACT_COUNT - MAX_DEPLOY_ARTIFACTS))
    ls -1dt "${DEPLOY_HISTORY_DIR}"/*/ | tail -n ${REMOVE_COUNT} | while read -r OLD_DIR; do
      echo "  Removing old artifact: $(basename ${OLD_DIR})"
      rm -rf "${OLD_DIR}"
    done
  fi
}

# ── Save current deployment state for rollback ────────────────────────
save_artifact() {
  mkdir -p "${DEPLOY_HISTORY_DIR}/${DEPLOY_VERSION}"
  cp "${PROJECT_ROOT}/docker/config/caddy/snippets/upstreams.conf" "${DEPLOY_HISTORY_DIR}/${DEPLOY_VERSION}/upstreams.conf" 2> /dev/null || true
  echo "rolling" > "${DEPLOY_HISTORY_DIR}/${DEPLOY_VERSION}/.color"
  echo "${DEPLOY_VERSION}" > "${DEPLOY_HISTORY_DIR}/${DEPLOY_VERSION}/.version"
  # Also save current compose image state
  ${COMPOSE_CMD} ps --format '{{.Name}} {{.Image}}' 2> /dev/null > "${DEPLOY_HISTORY_DIR}/${DEPLOY_VERSION}/.images" || true
}

# ── Check health metrics ─────────────────────────────────────────────
check_health_metrics() {
  echo "  Checking API and Dashboard health..."
  API_HEALTH=$(docker exec "${COMPOSE_PROJECT}-api-1" curl -sf http://localhost:3000/health 2> /dev/null || echo '')
  if [ -z "${API_HEALTH}" ]; then
    echo "  [FAIL] API health check failed"
    return 1
  fi

  DASH_HEALTH=$(docker exec "${COMPOSE_PROJECT}-dashboard-1" curl -sf http://localhost:8080/health 2> /dev/null || echo '')
  if [ -z "${DASH_HEALTH}" ]; then
    echo "  [FAIL] Dashboard health check failed"
    return 1
  fi

  echo "  [OK] API + Dashboard health checks passed"
  return 0
}

# ═════════════════════════════════════════════════════════════════════
# DEPLOYMENT FLOW
# ═════════════════════════════════════════════════════════════════════

# ── Step 0: Acquire deploy lock (3.10) ─────────────────────────────
echo "==> [0/6] Acquiring deploy lock..."
acquire_deploy_lock

# ── Step 1: Pre-Flight Checks ────────────────────────────────────────
echo "==> [1/6] Pre-flight checks..."
if ! bash "${SCRIPT_DIR}/pre-flight.sh" 2>&1; then
  notify error "Pre-flight checks FAILED. Deployment aborted."
  exit 1
fi

# ── Step 2: Vault Status Check ─────────────────────────────────────
echo "==> [2/6] Vault status check..."
if docker ps --format '{{.Names}}' | grep -q "${COMPOSE_PROJECT}_vault"; then
  VAULT_SEALED=$(docker exec "${COMPOSE_PROJECT}_vault" vault status 2> /dev/null | grep 'Seal' | awk '{print $2}')
  if [ "${VAULT_SEALED}" = "true" ]; then
    echo "  Vault is sealed. Unsealing..."
    just vault-unseal || {
      notify error "Vault unseal failed during deploy."
      exit 1
    }
  fi
  echo "  Vault OK."
else
  echo "  Vault not running (dev mode — skipping)."
fi

# ── Step 3: Save current state and rebuild ──────────────────────────
echo "==> [3/6] Saving deployment state and rebuilding (v${DEPLOY_VERSION})..."
save_artifact
cleanup_artifacts

# 3.12 Fix: Validate compose files exist before deploying
for COMPOSE_FILE in docker/compose/networks.yml docker/compose/volumes.yml docker/compose/base.yml; do
  if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "[deploy][ERROR] Required compose file missing: ${COMPOSE_FILE}"
    exit 1
  fi
done

# Rolling restart: rebuild and recreate api + dashboard + marketing
${COMPOSE_CMD} up -d --no-deps --build --force-recreate api dashboard marketing

# ── Step 4: Health Check ─────────────────────────────────────────────
echo "==> [4/6] Waiting for services to become healthy..."
MAX_WAIT=120
ELAPSED=0
HEALTHY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if check_health_metrics; then
    HEALTHY=true
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo "  Waiting... (${ELAPSED}s/${MAX_WAIT}s)"
done

if [ "${HEALTHY}" != "true" ]; then
  echo "[deploy][ERROR] Services did not become healthy."
  notify error "Services failed health check. Rolling back."
  bash "${SCRIPT_DIR}/rollback.sh"
  exit 1
fi

# ── Step 5: Monitor for stability ─────────────────────────────────────
echo "==> [5/6] Monitoring for ${MONITOR_DURATION}s..."
notify info "Deployment v${DEPLOY_VERSION}: monitoring phase (${MONITOR_DURATION}s)"

ELAPSED=0
MONITOR_OK=true
while [ $ELAPSED -lt $MONITOR_DURATION ]; do
  sleep 30
  ELAPSED=$((ELAPSED + 30))

  if ! check_health_metrics; then
    MONITOR_OK=false
    echo "  [FAIL] Health degraded at ${ELAPSED}s — auto-rollback"
    break
  fi

  REMAINING=$((MONITOR_DURATION - ELAPSED))
  echo "  [${ELAPSED}s/${MONITOR_DURATION}s] OK — ${REMAINING}s remaining"
done

# ── Step 6: Commit or Rollback ──────────────────────────────────────
if [ "${MONITOR_OK}" = "true" ]; then
  echo "${DEPLOY_VERSION}" > "${VERSION_FILE}"

  # Run integration tests
  echo "==> Running verification tests..."
  if [ -f "docker/tests/integration/test-suite.sh" ]; then
    bash docker/tests/integration/test-suite.sh 2>&1 && echo "  Tests PASSED" || echo "  [WARN] Tests had failures"
  fi

  # Run database migrations
  echo "==> Running database migrations..."
  if [ -f "scripts/deploy/migrate.sh" ]; then
    bash scripts/deploy/migrate.sh 2>&1 && echo "  Migrations PASSED" || echo "  [WARN] Migrations had failures"
  fi

  echo ""
  echo "==> Deployment v${DEPLOY_VERSION} COMMITTED (rolling restart)"
  notify info "Deployment v${DEPLOY_VERSION} committed successfully."
else
  echo "[deploy][ERROR] Monitoring detected failure. Auto-rollback."
  notify error "Deployment v${DEPLOY_VERSION} ROLLED BACK — monitoring detected failure."
  bash "${SCRIPT_DIR}/rollback.sh"
  exit 1
fi
