#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Wait for Core Services to Become Healthy
# Source: deployment.md v3.0.0, ADR-009
#
# Polls Docker health checks for all core services until healthy
# or timeout. Used by setup-dev / setup-prod after compose up.
#
# Usage:
#   bash docker/init/wait-for-services.sh dev
#   bash docker/init/wait-for-services.sh staging
#   bash docker/init/wait-for-services.sh prod
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV="${1:-dev}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"

if [ "${ENV}" = "prod" ]; then
  COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
fi

# Services to wait for (base services present in both dev and prod)
BASE_SERVICES=(
  "postgres-primary"
  "pgbouncer"
  "redis-primary"
  "minio"
)

# Prod-only additional services
PROD_SERVICES=(
  "vault"
)

MAX_WAIT=120    # seconds
POLL_INTERVAL=3 # seconds

# ── Helpers ────────────────────────────────────────────────────────
log_ok() { echo "[wait][OK] $*"; }
log_wait() { echo "[wait] $*"; }
log_err() { echo "[wait][ERROR] $*" >&2; }

# True when Vault is reachable but awaiting operator bootstrap (sealed or
# uninitialized). A sealed Vault always fails its own healthcheck —
# `vault status` exits 2 — yet that is normal after any restart, since
# unseal keys are memory-only. The setup recipes unseal right after this
# wait, so it must not be treated as a failed service.
vault_awaiting_bootstrap() {
  local container="${COMPOSE_PROJECT}_$1" status
  [ "$(docker inspect --format='{{.State.Running}}' "${container}" 2> /dev/null)" = "true" ] || return 1
  status=$(docker exec "${container}" vault status 2>&1 || true)
  echo "${status}" | grep -qE '^Sealed +true|^Initialized +false'
}

# Wait for a single service to become healthy
wait_for_service() {
  local service="$1"
  local elapsed=0

  while [ "$elapsed" -lt "$MAX_WAIT" ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "${COMPOSE_PROJECT}_${service}" 2> /dev/null || echo "not found")

    case "${STATUS}" in
    healthy)
      log_ok "${service} is healthy"
      return 0
      ;;
    unhealthy)
      if [ "${service}" = "vault" ] && vault_awaiting_bootstrap "${service}"; then
        log_wait "${service} is sealed or uninitialized — skipping health gate (setup recipe unseals it next)"
        return 0
      fi
      log_err "${service} is unhealthy (check logs: docker logs ${COMPOSE_PROJECT}_${service})"
      return 1
      ;;
    starting)
      log_wait "Waiting for ${service}... (${elapsed}s/${MAX_WAIT}s)"
      ;;
    not_found)
      # Service may not exist in this environment (e.g. vault in dev)
      log_wait "${service} not found (may not exist in ${ENV}) — skipping."
      return 0
      ;;
    esac

    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  log_err "${service} did not become healthy within ${MAX_WAIT}s"
  return 1
}

# ── Main ──────────────────────────────────────────────────────────
echo "[wait] Waiting for core services (env=${ENV}, project=${COMPOSE_PROJECT})..."
echo ""

ALL_SERVICES=("${BASE_SERVICES[@]}")
if [ "${ENV}" = "prod" ] || [ "${ENV}" = "staging" ]; then
  ALL_SERVICES+=("${PROD_SERVICES[@]}")
fi

FAILED=0
for svc in "${ALL_SERVICES[@]}"; do
  if ! wait_for_service "${svc}"; then
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [ "$FAILED" -gt 0 ]; then
  echo "[wait][ERROR] ${FAILED} service(s) failed to become healthy."
  exit 1
fi

echo "[wait] All core services are healthy."
