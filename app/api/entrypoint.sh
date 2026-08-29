#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# API Entrypoint
# Source: deployement.md v3.0.0, ADR-006, ADR-019
#
# Waits for dependencies (PgBouncer, Redis, Vault in prod),
# then starts the API server.
#
# Secrets strategy (ADR-006):
#   - Development:  sensitive values arrive as environment variables from .env
#   - Staging/Prod: fetched from Vault when VAULT_TOKEN is provided
#
# The application must expose:
#   GET /health       → 200 {"status":"ok"}
#   GET /db-health    → 200 {"pg":"up","redis":"up"}
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV="${ENVIRONMENT:-development}"
PGBOUNCER_HOST="${PGBOUNCER_HOST:-pgbouncer}"
PGBOUNCER_PORT="${PGBOUNCER_PORT:-6432}"
REDIS_HOST="${REDIS_HOST:-redis-primary}"
REDIS_PORT="${REDIS_PORT:-6379}"
MINIO_HOST="${MINIO_HOST:-minio}"
MINIO_PORT="${MINIO_PORT:-9000}"
VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-1}"

# ── Wait helper ─────────────────────────────────────────────────────
wait_for() {
  local host="$1" port="$2" name="$3" timeout="${4:-60}"
  local elapsed=0
  echo "[entrypoint] Waiting for ${name} (${host}:${port})..."
  while [ $elapsed -lt $timeout ]; do
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

# ── Wait for PgBouncer (all environments) ────────────────────────────
wait_for "${PGBOUNCER_HOST}" "${PGBOUNCER_PORT}" "PgBouncer" 60

# ── Wait for Redis ───────────────────────────────────────────────────
wait_for "${REDIS_HOST}" "${REDIS_PORT}" "Redis" 30

# ── Wait for MinIO (API uses object storage) ──────────────────────────
wait_for "${MINIO_HOST}" "${MINIO_PORT}" "MinIO" 30

# ── Wait for Vault (production only) ─────────────────────────────────
if [ "${ENV}" = "production" ]; then
  echo "[entrypoint] Production: waiting for Vault..."
  # Vault uses TCP but we can check the status endpoint via HTTP
  VAULT_CHECK_HOST="${VAULT_ADDR#http://}"
  VAULT_CHECK_HOST="${VAULT_CHECK_HOST#https://}"
  VAULT_CHECK_PORT="8200"
  wait_for "${VAULT_CHECK_HOST}" "${VAULT_CHECK_PORT}" "Vault" 60

  # ── Fetch secrets from Vault ────────────────────────────────────
  if [ -n "${VAULT_TOKEN:-}" ]; then
    echo "[entrypoint] Fetching secrets from Vault..."
    export VAULT_ADDR VAULT_SKIP_VERIFY VAULT_TOKEN

    # Fetch API secret key
    API_SECRET=$(vault kv get -field=key secret/app/api/secret-key 2> /dev/null || echo "")
    if [ -n "${API_SECRET}" ]; then
      export API_SECRET_KEY="${API_SECRET}"
    fi

    # Fetch Redis password
    REDIS_SECRET=$(vault kv get -field=password secret/app/api/redis 2> /dev/null || echo "")
    if [ -n "${REDIS_SECRET}" ]; then
      export REDIS_PASSWORD="${REDIS_SECRET}"
    fi

    # Fetch database URL
    DB_URL=$(vault kv get -field=url secret/app/api/database-url 2> /dev/null || echo "")
    if [ -n "${DB_URL}" ]; then
      export DATABASE_URL="${DB_URL}"
    fi

    echo "[entrypoint] Vault secrets loaded."
  else
    echo "[entrypoint][WARN] VAULT_TOKEN not set; relying on environment variables."
  fi
  unset VAULT_TOKEN
fi

# ── Build DATABASE_URL from POSTGRES_PASSWORD env var when not provided ──
if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export DATABASE_URL="postgresql://${POSTGRES_USER:-app}:${POSTGRES_PASSWORD}@${PGBOUNCER_HOST}:${PGBOUNCER_PORT}/${POSTGRES_DB:-app}"
fi

# ── Export OTEL env vars (already set in Dockerfile, overridden here) ──
export OTEL_EXPORTER_OTLP_ENDPOINT
export OTEL_SERVICE_NAME
export OTEL_SERVICE_VERSION
export OTEL_RESOURCE_ATTRIBUTES

# ── Start the application ────────────────────────────────────────────
echo "[entrypoint] Starting API server on port 3000..."
echo "[entrypoint]   PgBouncer: ${PGBOUNCER_HOST}:${PGBOUNCER_PORT}"
echo "[entrypoint]   Redis:     ${REDIS_HOST}:${REDIS_PORT}"
echo "[entrypoint]   MinIO:     ${MINIO_HOST}:${MINIO_PORT}"
echo "[entrypoint]   OTEL:      ${OTEL_EXPORTER_OTLP_ENDPOINT}"

exec "$@"
