#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# Canary Deployment — Rolling Restart with Incremental Verification
# ═════════════════════════════════════════════════════════════════════════════════
#
# NOTE: True canary requires a separate api-canary/dashboard-canary service
# with its own container, service name, and weighted routing in Caddy.
# This implementation performs a rolling restart with staged health verification
# at each step before committing fully.
#
# For true canary, define api-canary and dashboard-canary services in
# docker/compose/app.yml with scale=1, and use Caddy's lb_weight to
# shift traffic between api (stable) and api-canary.
#
# Usage:
#   bash scripts/deploy/canary.sh
#   DEPLOY_VERSION=v2.0.0 bash scripts/deploy/canary.sh
# ═════════════════════════════════════════════════════════════════════════════════
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
TELEGRAM_SH="${PROJECT_ROOT}/scripts/backup/telegram-notify.sh"
DEPLOY_VERSION="${DEPLOY_VERSION:-$(date +%Y%m%d-%H%M%S)}"

VERIFY_STEPS=3
WAIT_BETWEEN_STEPS=30

notify() {
  local level="$1" msg="$2"
  LEVEL=${level} CONTEXT=deploy TASK=rolling-deploy bash "${TELEGRAM_SH}" "${msg}" 2> /dev/null || true
}

# ── Step 1: Pre-flight ────────────────────────────────────────────
echo "==> [canary] Pre-flight checks..."
if ! bash "${SCRIPT_DIR}/pre-flight.sh" 2>&1; then
  notify error "Pre-flight checks FAILED. Canary aborted."
  exit 1
fi

# ── Step 2: Build new images ─────────────────────────────────────
echo "==> [canary] Building new images (v${DEPLOY_VERSION})..."
${COMPOSE_CMD} build api dashboard marketing

# ── Step 3: Deploy with rolling restart ─────────────────────────────
echo "==> [canary] Deploying with rolling restart..."
${COMPOSE_CMD} up -d --no-deps --build --force-recreate api dashboard marketing

# ── Step 4: Staged health verification ─────────────────────────────
echo "==> [canary] Staged health verification (${VERIFY_STEPS} rounds)..."

for i in $(seq 1 ${VERIFY_STEPS}); do
  echo "  Verification round ${i}/${VERIFY_STEPS}..."
  sleep ${WAIT_BETWEEN_STEPS}

  FAILED=0

  API_BODY=$(docker exec "${COMPOSE_PROJECT}-api-1" curl -sf http://localhost:3000/health 2> /dev/null || echo '')
  if [ -z "${API_BODY}" ]; then
    echo "  [FAIL] API health check failed at round ${i}"
    FAILED=1
  fi

  DB_BODY=$(docker exec "${COMPOSE_PROJECT}-api-1" curl -sf http://localhost:3000/db-health 2> /dev/null || echo '')
  if [ -z "${DB_BODY}" ]; then
    echo "  [FAIL] API DB health check failed at round ${i}"
    FAILED=1
  fi

  DASH_BODY=$(docker exec "${COMPOSE_PROJECT}-dashboard-1" curl -sf http://localhost:8080/health 2> /dev/null || echo '')
  if [ -z "${DASH_BODY}" ]; then
    echo "  [FAIL] Dashboard health check failed at round ${i}"
    FAILED=1
  fi

  if [ "${FAILED}" -ne 0 ]; then
    echo ""
    echo "[canary][ERROR] Health check failed at round ${i} — rolling back"
    notify error "Canary failed at round ${i}. Rolling back."
    bash "${SCRIPT_DIR}/rollback.sh"
    exit 1
  fi
  echo "  [OK] Round ${i} — all checks passed"
done

# ── Step 5: Commit ─────────────────────────────────────────────────
echo ""
echo "==> [canary] Deployment v${DEPLOY_VERSION} committed successfully."
notify info "Canary deployment v${DEPLOY_VERSION} committed successfully."
