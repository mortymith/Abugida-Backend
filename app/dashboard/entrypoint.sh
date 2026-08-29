#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Dashboard Entrypoint
#
# Waits for declared dependencies, then starts the TanStack Start
# production server (server.mjs).
#
# Dependency waits are OPTIONAL: they only run for hosts explicitly
# configured via environment variables (PGBOUNCER_HOST / REDIS_HOST), so
# the image also works standalone without the infra stack.
#
# The application must expose:
#   GET /health → 200 {"status":"ok"}
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PGBOUNCER_HOST="${PGBOUNCER_HOST:-}"
PGBOUNCER_PORT="${PGBOUNCER_PORT:-6432}"
REDIS_HOST="${REDIS_HOST:-}"
REDIS_PORT="${REDIS_PORT:-6379}"

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

# ── Wait for PgBouncer (only if configured) ──────────────────────────
if [ -n "${PGBOUNCER_HOST}" ]; then
  wait_for "${PGBOUNCER_HOST}" "${PGBOUNCER_PORT}" "PgBouncer" 60
fi

# ── Wait for Redis (only if configured) ──────────────────────────────
if [ -n "${REDIS_HOST}" ]; then
  wait_for "${REDIS_HOST}" "${REDIS_PORT}" "Redis" 30
fi

# ── Resolve database connection from environment variables ──────────
# DATABASE_URL is required by the Drizzle node-postgres client. When it is
# not provided directly, build it from the POSTGRES_PASSWORD env var
# (same pattern as the API entrypoint).
if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export DATABASE_URL="postgresql://${POSTGRES_USER:-app}:${POSTGRES_PASSWORD}@${PGBOUNCER_HOST:-pgbouncer}:${PGBOUNCER_PORT:-6432}/${POSTGRES_DB:-app}"
fi

# ── Export OTEL env vars (defaults from the image, overridable) ──────
export OTEL_EXPORTER_OTLP_ENDPOINT
export OTEL_SERVICE_NAME
export OTEL_SERVICE_VERSION
export OTEL_RESOURCE_ATTRIBUTES

# ── Start the application ────────────────────────────────────────────
echo "[entrypoint] Starting dashboard server on port ${PORT:-8080}..."
exec "$@"
