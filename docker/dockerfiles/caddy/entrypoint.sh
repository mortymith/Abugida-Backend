#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Caddy Entrypoint — Active/Standby support (ADR-011)
# ═════════════════════════════════════════════════════════════════════
# The ROLE env var determines behavior:
#   - "active":  Normal startup, binds :80/:443
#   - "standby": Normal startup, same config; Keepalived
#                controls which instance receives traffic via VIP.
# Both instances run identical configs; keepalived manages the VIP.
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ROLE="${ROLE:-active}"
PEER_HOST="${PEER_HOST:-caddy-active}"
PEER_PORT="${PEER_PORT:-80}"
LOG_DIR="/var/log/caddy"
mkdir -p "${LOG_DIR}"

echo "[caddy-entrypoint] Role: ${ROLE}"

# ── Wait for backend services (basic TCP check) ──────────────────────
wait_for() {
  local host="$1" port="$2" name="$3" timeout="${4:-30}"
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if (echo > "/dev/tcp/${host}/${port}") 2> /dev/null; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "[caddy-entrypoint][WARN] ${name} not ready after ${timeout}s, continuing anyway"
}

# Don't block startup on backends — Caddy will retry failed upstreams
wait_for api 3000 API 10 || true
wait_for dashboard 8080 Dashboard 10 || true
wait_for marketing 8080 Marketing 10 || true

echo "[caddy-entrypoint] Starting Caddy (role=${ROLE})..."

exec "$@"
