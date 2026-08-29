#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Production Deployment
# Source: deployment.md v3.0.0, ADR-009, ADR-011
#
# Dispatches to the correct deployment strategy based on DEPLOY_STRATEGY.
#   - recreate:   docker compose up -d --force-recreate (default)
#   - blue-green: blue-green.sh with upstream cutover
#   - rolling:    rolling restart with health checks
#   - canary:     canary.sh with gradual traffic shift
#
# Usage:
#   bash scripts/deploy/deploy.sh prod
#   DEPLOY_STRATEGY=blue-green bash scripts/deploy/deploy.sh prod
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV="${1:-prod}"
STRATEGY="${DEPLOY_STRATEGY:-recreate}"
COMPOSE_CMD="docker compose --project-directory . -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/edge.yml -f docker/compose/scaling.yml -f docker/compose/security.yml -f docker/compose/profiles/prod.override.yml"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [deploy] Version: ${DEPLOY_VERSION:-latest}"
echo "==> [deploy] Environment: ${ENV}"

echo "==> [deploy] Strategy:   ${STRATEGY}"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────
echo "==> [deploy] Running pre-flight checks..."
if ! bash "${SCRIPT_DIR}/pre-flight.sh" --status-only; then
  echo "[deploy][ERROR] Pre-flight checks failed. Aborting."
  exit 1
fi

# ── Dispatch to strategy ──────────────────────────────────────────
case "${STRATEGY}" in
recreate)
  echo "==> [deploy] Running recreate deployment..."
  ${COMPOSE_CMD} up -d --force-recreate --remove-orphans
  echo "==> [deploy] Recreate deployment complete."
  ;;
blue-green)
  echo "==> [deploy] Running blue-green deployment..."
  bash "${SCRIPT_DIR}/blue-green.sh" "${ENV}"
  ;;
rolling)
  echo "==> [deploy] Running rolling deployment..."
  ${COMPOSE_CMD} up -d --no-deps --build api dashboard marketing
  echo "==> [deploy] Rolling deployment complete."
  ;;
canary)
  echo "==> [deploy] Running canary deployment..."
  bash "${SCRIPT_DIR}/canary.sh" "${ENV}"
  ;;
*)
  echo "[deploy][ERROR] Unknown strategy: ${STRATEGY}"
  echo "  Valid strategies: recreate, blue-green, rolling, canary"
  exit 1
  ;;
esac

echo ""
echo "==> [deploy] Deployment complete (strategy=${STRATEGY})."
