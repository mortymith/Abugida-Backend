#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Worker Entrypoint
# ADR-006 (secrets), ADR-028 (the background job consumer)
#
# Waits for Redis, fetches the provider secrets from Vault in staging/prod,
# then starts the queue consumer.
#
# Secrets strategy (ADR-006):
#   - Development:  sensitive values arrive as environment variables from .env
#   - Staging/Prod: fetched from Vault when VAULT_TOKEN is provided
#
# The worker must expose:
#   GET /health       → 200 {"status":"ok"}
#   GET /health/ready → 200 when Redis is reachable and every expected queue
#                       worker has started
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV="${ENVIRONMENT:-development}"
REDIS_HOST="${REDIS_HOST:-redis-primary}"
REDIS_PORT="${REDIS_PORT:-6379}"
VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-1}"

# ── Wait helper ─────────────────────────────────────────────────────
wait_for() {
  local host="$1" port="$2" name="$3" timeout="${4:-60}"
  local elapsed=0
  echo "[entrypoint] Waiting for ${name} (${host}:${port})..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    if (echo > "/dev/tcp/${host}/${port}") 2> /dev/null; then
      echo "[entrypoint] ${name} is ready."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "[entrypoint][ERROR] ${name} not ready after ${timeout}s" >&2
  return 1
}

# ── Wait for Redis (the queue store) ────────────────────────────────
wait_for "${REDIS_HOST}" "${REDIS_PORT}" "Redis" 30

# ── Wait for Vault (production only) ─────────────────────────────────
if [ "${ENV}" = "production" ]; then
  echo "[entrypoint] Production: waiting for Vault..."
  VAULT_CHECK_HOST="${VAULT_ADDR#http://}"
  VAULT_CHECK_HOST="${VAULT_CHECK_HOST#https://}"
  wait_for "${VAULT_CHECK_HOST}" "8200" "Vault" 60

  # ── Fetch secrets from Vault ────────────────────────────────────
  if [ -n "${VAULT_TOKEN:-}" ]; then
    echo "[entrypoint] Fetching secrets from Vault..."
    export VAULT_ADDR VAULT_SKIP_VERIFY VAULT_TOKEN

    fetch_secret() { # fetch_secret <path> <target-var>
      local value
      value=$(vault kv get -field=key "secret/app/$1" 2> /dev/null || echo "")
      if [ -n "${value}" ]; then
        export "$2=${value}"
      fi
    }

    # Redis ACL password — the queue store is unreachable without it.
    REDIS_SECRET=$(vault kv get -field=password secret/app/api/redis 2> /dev/null || echo "")
    if [ -n "${REDIS_SECRET}" ]; then
      export REDIS_PASSWORD="${REDIS_SECRET}"
    fi

    # Payment gateway (Telebirr) — only the worker calls these APIs.
    fetch_secret "telebirr/app-secret" TELEBIRR_APP_SECRET
    fetch_secret "telebirr/merchant-app-id" TELEBIRR_MERCHANT_APP_ID
    fetch_secret "telebirr/merchant-code" TELEBIRR_MERCHANT_CODE
    fetch_secret "telebirr/private-key" TELEBIRR_PRIVATE_KEY
    fetch_secret "telebirr/public-key" TELEBIRR_PUBLIC_KEY

    # SMS gateway (SMSEthiopia).
    fetch_secret "sms-ethiopia/api-key" SMS_ETHIOPIA_API_KEY

    echo "[entrypoint] Vault secrets loaded."
  else
    echo "[entrypoint][WARN] VAULT_TOKEN not set; relying on environment variables."
  fi
  unset VAULT_TOKEN
fi

# ── Export OTEL env vars (already set in Dockerfile, overridden here) ──
export OTEL_EXPORTER_OTLP_ENDPOINT
export OTEL_SERVICE_NAME
export OTEL_SERVICE_VERSION
export OTEL_RESOURCE_ATTRIBUTES

# ── Start the worker ────────────────────────────────────────────────
echo "[entrypoint] Starting background worker..."
echo "[entrypoint]   Redis:  ${REDIS_HOST}:${REDIS_PORT}"
echo "[entrypoint]   Queues: ${WORKER_QUEUES:-all}"
echo "[entrypoint]   OTEL:   ${OTEL_EXPORTER_OTLP_ENDPOINT}"

exec "$@"
