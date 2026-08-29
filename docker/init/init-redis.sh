#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Redis Cluster Initialization (production only)
# Source: deployment.md v3.0.0, ADR-014, ADR-022
#
# Waits for redis-primary to be healthy, then:
#   1. Configures replicas via redis-cli REPLICAOF (if not already)
#   2. Configures Sentinels to monitor the correct primary
#
# Idempotent — safe to re-run on restart.
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ── Resolve passwords (ADR-006: env vars from .env or Vault export) ──
# Prefer an exported env var; fall back to the project .env file (dev).
load_env_var() {
  local key="$1" current
  current="${!key:-}"
  if [ -n "${current}" ]; then
    printf '%s' "${current}"
  elif [ -f "${PROJECT_ROOT}/.env" ]; then
    printf '%s' "$(grep -E "^${key}=" "${PROJECT_ROOT}/.env" 2> /dev/null | head -1 | cut -d'=' -f2-)"
  fi
}
REDIS_PASSWORD="${REDIS_PASSWORD:-$(load_env_var REDIS_PASSWORD)}"
SENTINEL_PASSWORD="${REDIS_SENTINEL_PASSWORD:-$(load_env_var REDIS_SENTINEL_PASSWORD)}"
QUORUM="${REDIS_SENTINEL_QUORUM:-$(load_env_var REDIS_SENTINEL_QUORUM)}"
QUORUM="${QUORUM:-2}"

# ── CLI helpers ─────────────────────────────────────────────────────
PRIMARY_CLI="docker exec ${COMPOSE_PROJECT}_redis-primary redis-cli -u redis://admin:${REDIS_PASSWORD}@localhost:6379"

sentinel_cli() {
  local sentinel_num="$1"
  shift
  docker exec "${COMPOSE_PROJECT}_redis-sentinel-${sentinel_num}" \
    redis-cli -u "redis://default:${SENTINEL_PASSWORD}@localhost:26379" "$@"
}

# ── Wait for primary ────────────────────────────────────────────────
echo "[init-redis] Waiting for redis-primary to be healthy..."

MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  if $PRIMARY_CLI ping 2> /dev/null | grep -q PONG; then
    echo "[init-redis] redis-primary is responding PONG."
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "[init-redis][ERROR] redis-primary did not become healthy within ${MAX_WAIT}s"
  exit 1
fi

# ── Configure Replicas ──────────────────────────────────────────────
# Replicas are started with ROLE=replica and --replicaof in the entrypoint.
# This step verifies replication is active and logs status.

for i in 1 2; do
  REPLICA_CLI="docker exec ${COMPOSE_PROJECT}_redis-replica-${i} redis-cli -u redis://admin:${REDIS_PASSWORD}@localhost:6379"
  echo "[init-redis] Checking replica-${i} replication status..."

  # Wait for replica to be ready
  REPLICA_WAIT=30
  REPLICA_ELAPSED=0
  while [ $REPLICA_ELAPSED -lt $REPLICA_WAIT ]; do
    if $REPLICA_CLI ping 2> /dev/null | grep -q PONG; then
      break
    fi
    sleep 2
    REPLICA_ELAPSED=$((REPLICA_ELAPSED + 2))
  done

  # Verify replication link
  ROLE_VAL=$($REPLICA_CLI INFO replication 2> /dev/null | grep 'role:' | head -1 | tr -d '\r' | cut -d: -f2)
  if [ "${ROLE_VAL}" = 'slave' ] || [ "${ROLE_VAL}" = 'replica' ]; then
    LINK_STATUS=$($REPLICA_CLI INFO replication 2> /dev/null | grep 'master_link_status:' | head -1 | tr -d '\r' | cut -d: -f2)
    echo "[init-redis] redis-replica-${i}: role=${ROLE_VAL}, link=${LINK_STATUS}"
  else
    echo "[init-redis][WARN] redis-replica-${i} reports role=${ROLE_VAL} (expected slave/replica)"
  fi
done

# ── Configure Sentinels ─────────────────────────────────────────────
PRIMARY_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${COMPOSE_PROJECT}_redis-primary" 2> /dev/null)"
if [ -z "${PRIMARY_IP}" ]; then
  echo "[init-redis][ERROR] Could not determine redis-primary IP address"
  exit 1
fi

echo "[init-redis] redis-primary IP: ${PRIMARY_IP}"
echo "[init-redis] Configuring Sentinels to monitor mymaster at ${PRIMARY_IP}:6379..."

for i in 1 2 3; do
  echo "[init-redis] Configuring redis-sentinel-${i}..."

  # Wait for sentinel to be ready
  SENTINEL_WAIT=20
  SENTINEL_ELAPSED=0
  while [ $SENTINEL_ELAPSED -lt $SENTINEL_WAIT ]; do
    if sentinel_cli "$i" ping 2> /dev/null | grep -q PONG; then
      break
    fi
    sleep 2
    SENTINEL_ELAPSED=$((SENTINEL_ELAPSED + 2))
  done

  # Remove default monitor (127.0.0.1) and set correct primary
  sentinel_cli "$i" SENTINEL REMOVE mymaster 2> /dev/null || true
  sentinel_cli "$i" SENTINEL MONITOR mymaster "${PRIMARY_IP}" 6379 "${QUORUM}"
  sentinel_cli "$i" SENTINEL SET mymaster down-after-milliseconds 5000
  sentinel_cli "$i" SENTINEL SET mymaster failover-timeout 10000
  sentinel_cli "$i" SENTINEL SET mymaster parallel-syncs 1

  # Set auth password for Sentinel to connect to Redis nodes
  sentinel_cli "$i" SENTINEL SET mymaster auth-pass "${REDIS_PASSWORD}"

  echo "[init-redis] redis-sentinel-${i} configured."
done

# ── Verify Cluster ──────────────────────────────────────────────────
echo ""
echo "[init-redis] ── Verification ──"

echo ""
echo "--- Primary INFO REPLICATION ---"
$PRIMARY_CLI INFO replication 2> /dev/null | grep -E 'role:|connected_slaves:|slave[0-9]+:|master_link_status:' | head -10

echo ""
echo "--- Sentinel 1: SENTINEL MASTER mymaster ---"
sentinel_cli 1 SENTINEL MASTER mymaster 2> /dev/null | grep -E 'name|ip|port|num-slaves|quorum|flags'

echo ""
echo "[init-redis] Redis cluster initialization complete."
