#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Redis Entrypoint — multi-role (primary / replica / sentinel)
# Source: deployment.md v3.0.0, ADR-014, ADR-022
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ROLE="${ROLE:-primary}"

# ── Resolve passwords from environment variables (ADR-006) ──────────
# Injected from .env in development, exported from Vault in staging/prod.
REDIS_ADMIN_PASSWORD="${REDIS_ADMIN_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_READONLY_PASSWORD="${REDIS_READONLY_PASSWORD:-}"
REDIS_SENTINEL_PASSWORD="${REDIS_SENTINEL_PASSWORD:-}"

# ── Generate users.acl from template (3.7 Fix: safe temp file) ─────
ACL_FILE="/usr/local/etc/redis/users.acl"
TPL_FILE="/usr/local/etc/redis/users.acl.tpl"

# Use a temp file and atomic move to prevent partial writes
TMP_ACL=$(mktemp)

# Write FIRST (as current user), then set final ownership/permissions.
# Chowning before writing fails on hardened runtimes where root lacks
# CAP_DAC_OVERRIDE once the file no longer belongs to root.
awk -v admin="${REDIS_ADMIN_PASSWORD}" \
  -v app="${REDIS_PASSWORD}" \
  -v readonly="${REDIS_READONLY_PASSWORD}" \
  -v sentinel="${REDIS_SENTINEL_PASSWORD}" \
  '{
        # ACL files allow only user directives — drop comments/blank lines
        if (substr($0, 1, 1) == "#" || $0 == "") next
        gsub(/\{\{REDIS_ADMIN_PASSWORD\}\}/, admin);
        gsub(/\{\{REDIS_PASSWORD\}\}/, app);
        gsub(/\{\{REDIS_READONLY_PASSWORD\}\}/, readonly);
        gsub(/\{\{REDIS_SENTINEL_PASSWORD\}\}/, sentinel);
        print
    }' "${TPL_FILE}" > "${TMP_ACL}"
chmod 640 "${TMP_ACL}"
chown redis:redis "${TMP_ACL}"
mv "${TMP_ACL}" "${ACL_FILE}"
chmod 640 "${ACL_FILE}"
chown redis:redis "${ACL_FILE}"

# ── 3.1 Fix: TLS configuration ────────────────────────────────────
TLS_ENABLED="${REDIS_TLS_ENABLED:-0}"
TLS_EXTRA_ARGS=""
if [ "${TLS_ENABLED}" = "1" ] && [ -f /etc/redis/tls/redis.crt ]; then
  # redis.conf has tls-port 6379 and port 0 — keep as-is for TLS mode
  TLS_EXTRA_ARGS="--tls-cert-file /etc/redis/tls/redis.crt --tls-key-file /etc/redis/tls/redis.key --tls-ca-cert-file /etc/redis/tls/ca.crt --tls-auth-clients optional"
else
  # Switch: enable plain port, disable tls-port
  sed -i 's/^port 0$/port 6379/' /usr/local/etc/redis/redis.conf
  sed -i 's/^tls-port 6379$/tls-port 0/' /usr/local/etc/redis/redis.conf
fi
# ── 2.6 Fix: Rewrite health check with auth ─────────────────────────
# The Docker HEALTHCHECK uses redis-cli ping without auth.
# Overwrite it at startup with the actual password.
if [ -n "${REDIS_PASSWORD}" ] && [ "${ROLE}" != "sentinel" ]; then
  # Cannot modify Docker HEALTHCHECK from inside container,
  # but we can note that redis-cli --no-auth-warning -a <pass> ping
  # should be used by external monitoring.
  echo "[entrypoint] Redis password set. External health checks must use: redis-cli -a <password> ping"
fi

# ── Memory ceiling from environment (REDIS_MAXMEMORY / REDIS_MAXMEMORY_POLICY) ──
# redis.conf ships a static default (2gb); when .env/Vault provides values they
# win. Applied to server roles only — sentinels don't load redis.conf.
MEMORY_ARGS=""
if [ -n "${REDIS_MAXMEMORY:-}" ]; then
  MEMORY_ARGS="--maxmemory ${REDIS_MAXMEMORY}"
  if [ -n "${REDIS_MAXMEMORY_POLICY:-}" ]; then
    MEMORY_ARGS="${MEMORY_ARGS} --maxmemory-policy ${REDIS_MAXMEMORY_POLICY}"
  fi
  echo "[entrypoint] Applying memory limit: ${REDIS_MAXMEMORY} (${REDIS_MAXMEMORY_POLICY:-config default})"
fi

# ── Dispatch by ROLE ───────────────────────────────────────────────
case "${ROLE}" in
sentinel)
  echo "[entrypoint] Starting Redis Sentinel..."
  exec redis-sentinel /usr/local/etc/redis/redis-sentinel.conf
  ;;

replica)
  # Build additional config for replica mode
  PRIMARY_HOST="${REDIS_PRIMARY_HOST:-redis-primary}"
  PRIMARY_PORT="${REDIS_PRIMARY_PORT:-6379}"
  echo "[entrypoint] Starting Redis Replica (primary: ${PRIMARY_HOST}:${PRIMARY_PORT})..."
  exec redis-server /usr/local/etc/redis/redis.conf \
    --replicaof "${PRIMARY_HOST}" "${PRIMARY_PORT}" \
    --masterauth "${REDIS_PASSWORD}" \
    --replica-serve-stale-data yes \
    --replica-read-only yes \
    ${MEMORY_ARGS} \
    ${TLS_EXTRA_ARGS}
  ;;

primary | *)
  # Standalone primary accepts writes with no attached replicas;
  # deployments running replicas set REDIS_MIN_REPLICAS=1 via compose.
  echo "[entrypoint] Starting Redis Primary..."
  exec redis-server /usr/local/etc/redis/redis.conf \
    --min-replicas-to-write "${REDIS_MIN_REPLICAS:-0}" \
    --min-replicas-max-lag "${REDIS_MIN_REPLICAS_MAX_LAG:-10}" \
    ${MEMORY_ARGS} \
    ${TLS_EXTRA_ARGS}
  ;;
esac
