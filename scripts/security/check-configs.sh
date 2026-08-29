#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Configuration Security Scanner
# Source: deployment.md v3.0.0 Phase 14, ADR-004
#
# Scans compose files, Caddy, Vault, Redis, Postgres, and ClickHouse
# configs for insecure defaults, misconfigurations, and policy violations.
#
# Checks:
#   1. Docker Compose: exposed ports in prod, privileged mode, missing healthchecks
#   2. Caddy: missing TLS, open CORS, missing security headers
#   3. Vault: dev mode, insecure TLS, default paths
#   4. Redis: unprotected, default password, no ACL
#   5. Postgres: trust auth, no encryption, weak passwords
#   6. ClickHouse: default password, exposed ports
#   7. OTEL/SigNoz: exposed internal endpoints
#   8. General: hardcoded IPs, secrets in config files, .env in repo
#
# Usage:
#   bash scripts/security/check-configs.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ── Configuration ──────────────────────────────────────────────────
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
TOTAL_FINDINGS=0

# ── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

log_critical() {
  echo -e "  ${RED}[CRITICAL]${RESET} $*"
  ((CRITICAL++)) || true
  ((TOTAL_FINDINGS++)) || true
}
log_high() {
  echo -e "  ${RED}[HIGH]${RESET}     $*"
  ((HIGH++)) || true
  ((TOTAL_FINDINGS++)) || true
}
log_medium() {
  echo -e "  ${YELLOW}[MEDIUM]${RESET}   $*"
  ((MEDIUM++)) || true
  ((TOTAL_FINDINGS++)) || true
}
log_low() {
  echo -e "  ${YELLOW}[LOW]${RESET}      $*"
  ((LOW++)) || true
  ((TOTAL_FINDINGS++)) || true
}

# Helper: grep a file for a pattern, report findings per line
check_file() {
  local file="$1"
  local desc="$2"
  local severity="$3"
  local pattern="$4"
  local relpath="${file#${PROJECT_ROOT}/}"

  [ ! -f "$file" ] && return 0

  while IFS= read -r match; do
    [ -z "$match" ] && continue
    line_num=$(echo "$match" | cut -d: -f1)
    line_content=$(echo "$match" | cut -d: -f2- | sed 's/^[[:space:]]*//')
    case "$severity" in
    critical) log_critical "${relpath}:${line_num}: ${desc} → ${line_content}" ;;
    high) log_high "${relpath}:${line_num}: ${desc} → ${line_content}" ;;
    medium) log_medium "${relpath}:${line_num}: ${desc} → ${line_content}" ;;
    *) log_low "${relpath}:${line_num}: ${desc} → ${line_content}" ;;
    esac
  done < <(grep -n -E "$pattern" "$file" 2> /dev/null || true)
}

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Configuration Security Scanner${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# ═════════════════════════════════════════════════════════════════════
# 1. Docker Compose Files
# ═════════════════════════════════════════════════════════════════════
echo -e "${BOLD}── Docker Compose Analysis ──${RESET}"

# Prod overlay should not expose ports (except Caddy 80/443)
check_file "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" \
  "Port exposed in prod overlay" high \
  'ports:.*-[0-9]+' |
  grep -v ':80:' | grep -v ':443:' | head -20 || true

# Check for privileged mode
for f in docker/compose/base.yml docker/compose/profiles/prod.override.yml docker/compose/profiles/dev.override.yml; do
  check_file "${PROJECT_ROOT}/$f" "Privileged mode enabled" critical 'privileged\s*:\s*true'
done

# Check for security_opt: no-new-privileges missing in prod
if [ -f "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" ]; then
  if ! grep -q 'no-new-privileges' "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" 2> /dev/null; then
    log_medium "docker/compose/profiles/prod.override.yml: no 'no-new-privileges' security_opt found on any service"
  fi
fi

# Check for read_only in prod
if [ -f "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" ]; then
  if ! grep -q 'read_only' "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" 2> /dev/null; then
    log_low "docker/compose/profiles/prod.override.yml: no 'read_only: true' found (consider for non-root services)"
  fi
fi

# Check for cap_drop ALL
if [ -f "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" ]; then
  if ! grep -q 'cap_drop' "${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml" 2> /dev/null; then
    log_medium "docker/compose/profiles/prod.override.yml: no 'cap_drop: [ALL]' found on any service"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# 2. Caddy Configuration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Caddy Configuration ──${RESET}"

CADDYFILE="${PROJECT_ROOT}/docker/config/caddy/Caddyfile"
if [ -f "$CADDYFILE" ]; then
  # Check for http:// only (no TLS)
  check_file "$CADDYFILE" "HTTP-only site block (no TLS)" high '^\s*http://'

  # Check for overly permissive CORS
  check_file "$CADDYFILE" "Wildcard CORS origin" medium 'origin\s+\*'
  check_file "$CADDYFILE" "CORS allow_all" high 'allow_all'

  # Check for missing security headers in snippets
  SECURITY_SNIPPET="${PROJECT_ROOT}/docker/config/caddy/snippets/security.conf"
  if [ -f "$SECURITY_SNIPPET" ]; then
    for header in "X-Content-Type-Options" "X-Frame-Options" "Strict-Transport-Security" "Content-Security-Policy"; do
      if ! grep -qF "$header" "$SECURITY_SNIPPET" 2> /dev/null; then
        log_medium "security.conf: missing header '${header}'"
      fi
    done
  else
    log_low "security.conf snippet not found"
  fi
else
  log_low "Caddyfile not found at docker/config/caddy/Caddyfile"
fi

# ═════════════════════════════════════════════════════════════════════
# 3. Vault Configuration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Vault Configuration ──${RESET}"

VAULT_CONFIG="${PROJECT_ROOT}/docker/config/vault/vault-config.hcl"
if [ -f "$VAULT_CONFIG" ]; then
  check_file "$VAULT_CONFIG" "Vault dev mode enabled" critical 'dev_mode\s*\=\s*true'
  check_file "$VAULT_CONFIG" "Vault TLS disabled" critical 'disable_mlock\s*\=\s*true'
  check_file "$VAULT_CONFIG" "Vault insecure TLS" critical 'tls_disable\s*\=\s*1|tls_disable\s*\=\s*true'
  check_file "$VAULT_CONFIG" "Vault default listener without TLS" high 'listener.*\{[^}]*tls\s*=\s*"false' || true
fi

# ═════════════════════════════════════════════════════════════════════
# 4. Redis Configuration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Redis Configuration ──${RESET}"

REDIS_CONF="${PROJECT_ROOT}/docker/config/redis/redis.conf"
if [ -f "$REDIS_CONF" ]; then
  # Check if protected-mode is off
  check_file "$REDIS_CONF" "Redis protected-mode disabled" high 'protected-mode\s+no'

  # Check if requirepass is missing
  if ! grep -q 'requirepass' "$REDIS_CONF" 2> /dev/null; then
    log_high "redis.conf: no 'requirepass' directive (password authentication)"
  fi

  # Check if ACL file is referenced
  if ! grep -q 'aclfile' "$REDIS_CONF" 2> /dev/null; then
    log_medium "redis.conf: no 'aclfile' directive (ACL-based auth preferred)"
  fi

  # Check for dangerous commands enabled
  check_file "$REDIS_CONF" "Dangerous Redis command enabled" medium 'rename-command.*""|CONFIG\s+COMMAND\s+CONFIG'

  # Check if bind is restrictive
  if grep -q 'bind 0.0.0.0' "$REDIS_CONF" 2> /dev/null; then
    log_medium "redis.conf: binds to 0.0.0.0 (use specific interface or Docker network isolation)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# 5. PostgreSQL Configuration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── PostgreSQL Configuration ──${RESET}"

PG_HBA="${PROJECT_ROOT}/docker/config/postgres/conf/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
  # Check for trust auth
  check_file "$PG_HBA" "Trust authentication enabled" critical '\btrust\b'
  # Check for password auth without SCRAM
  check_file "$PG_HBA" "Plain password auth (prefer scram-sha-256)" medium '\bpassword\b'
  # Check for 0.0.0.0/0 or ::/0
  check_file "$PG_HBA" "PostgreSQL open to all hosts" critical '0\.0\.0\.0/0|::/0'
fi

PG_CONF="${PROJECT_ROOT}/docker/config/postgres/conf/postgresql.conf"
if [ -f "$PG_CONF" ]; then
  # Check SSL is enabled
  if ! grep -qE '^ssl\s*=\s*on' "$PG_CONF" 2> /dev/null; then
    log_medium "postgresql.conf: SSL not explicitly enabled"
  fi
  # Check for log_connections
  if ! grep -qE '^log_connections\s*=' "$PG_CONF" 2> /dev/null; then
    log_low "postgresql.conf: 'log_connections' not set (audit trail)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# 6. ClickHouse Configuration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── ClickHouse Configuration ──${RESET}"

CH_CONFIG="${PROJECT_ROOT}/docker/config/clickhouse/config.xml"
if [ -f "$CH_CONFIG" ]; then
  check_file "$CH_CONFIG" "ClickHouse listens on 0.0.0.0" medium 'listen_host>[^<]*0\.0\.0\.0'
  # Check for default password
  check_file "$CH_CONFIG" "ClickHouse default/empty password" critical '<password>\s*</password>|<password></password>'
  check_file "$CH_CONFIG" "ClickHouse default user 'default'" medium '<user><name>default</name>'
fi

# ═════════════════════════════════════════════════════════════════════
# 7. OTEL Collector Configuration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── OpenTelemetry Collector ──${RESET}"

OTEL_CONFIG="${PROJECT_ROOT}/docker/config/opentelemetry/collector-config.yml"
if [ -f "$OTEL_CONFIG" ]; then
  # Check for authless exporters
  check_file "$OTEL_CONFIG" "OTEL exporter without auth/tls" medium 'endpoint:\s*http://'
  # Check if debug is enabled (should be off in prod)
  check_file "$OTEL_CONFIG" "OTEL debug/logging verbose enabled" low 'level:\s*debug'
fi

# ═════════════════════════════════════════════════════════════════════

# ═════════════════════════════════════════════════════════════════════
# 8. PowerSync / PgBouncer Bypass Check
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── PowerSync / PgBouncer Bypass ──${RESET}"

# Verify NEITHER PowerSync role routes through PgBouncer. Both connect
# directly to postgres-primary:5432 — transaction-mode pooling would sever
# the logical-replication stream (see docs/services/powersync.md).
# --env-file is explicit because multi-`-f` compose resolves .env relative
# to the first compose file's directory, not the caller's cwd.
PS_ENV_FILE_ARGS=""
[ -f "${PROJECT_ROOT}/.env" ] && PS_ENV_FILE_ARGS="--env-file ${PROJECT_ROOT}/.env"
POWERSYNC_COMPOSE_CONFIG=$(docker compose --project-directory . ${PS_ENV_FILE_ARGS} -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml config 2> /dev/null || true)
if [ -z "${POWERSYNC_COMPOSE_CONFIG}" ]; then
  log_high "Could not render compose config (missing .env?) — PowerSync PgBouncer bypass check skipped"
elif echo "${POWERSYNC_COMPOSE_CONFIG}" | grep -q 'powersync-sync'; then
  if echo "${POWERSYNC_COMPOSE_CONFIG}" |
    grep -A25 'powersync-sync:' | grep -q 'pgbouncer' ||
    echo "${POWERSYNC_COMPOSE_CONFIG}" |
    grep -A25 'powersync-api:' | grep -q 'pgbouncer'; then
    log_critical "PowerSync references pgbouncer — logical replication requires DIRECT connection to postgres-primary:5432"
  else
    echo -e "  ${GREEN}OK${RESET}: PowerSync does not route through PgBouncer"
  fi
else
  log_high "powersync-sync service not found in compose config"
fi

# Verify the Sync Streams config exists and declares an edition
PS_SYNC_CONFIG="${PROJECT_ROOT}/docker/config/powersync/sync-config.yaml"
if [ -f "${PS_SYNC_CONFIG}" ]; then
  if grep -q '^config:' "${PS_SYNC_CONFIG}" && grep -q '^\s*streams:' "${PS_SYNC_CONFIG}"; then
    echo -e "  ${GREEN}OK${RESET}: sync-config.yaml defines sync streams"
  else
    log_high "sync-config.yaml is missing stream definitions — PowerSync would sync zero tables"
  fi
else
  log_high "docker/config/powersync/sync-config.yaml not found — PowerSync has no sync configuration"
fi

# Verify wal_level supports logical decoding
if [ -f "${PG_CONF}" ]; then
  WL=$(grep -E '^wal_level\s*=' "${PG_CONF}" 2> /dev/null | head -1 | awk -F= '{print $2}' | tr -d ' ')
  if [ "${WL}" != "logical" ]; then
    log_high "postgresql.conf: wal_level='${WL:-unset}' — PowerSync requires wal_level=logical"
  else
    echo -e "  ${GREEN}OK${RESET}: wal_level=logical"
  fi
fi
# 9. General Security Checks
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── General Security Checks ──${RESET}"

# Check for .env.prod in git staging area
if git -C "${PROJECT_ROOT}" ls-files --error-unmatch .env.prod > /dev/null 2>&1; then
  log_critical ".env.prod is tracked by git — remove it and add to .gitignore"
fi
if git -C "${PROJECT_ROOT}" ls-files --error-unmatch .env.dev > /dev/null 2>&1; then
  log_high ".env.dev is tracked by git — remove it and add to .gitignore"
fi

# Check for hardcoded IPs in configs
HARDCODED_IPS=$(rg -l '172\.(20|21|22)\.\d+\.\d+' \
  --type-add 'config:yml,yaml,conf,ini,hcl,env,sh' \
  -t config -t sh \
  "${PROJECT_ROOT}/docker/config/" "${PROJECT_ROOT}/scripts/" 2> /dev/null |
  grep -v 'networking.md' | grep -v 'redis-firewall.sh' | grep -v 'check-configs.sh' || true)
if [ -n "$HARDCODED_IPS" ]; then
  echo "$HARDCODED_IPS" | while read -r f; do
    relpath="${f#${PROJECT_ROOT}/}"
    log_low "${relpath}: contains hardcoded subnet IPs (use env vars per ADR-004)"
  done
fi

# Check for secrets in config files (non-secret paths)
SECRET_IN_CONFIG=$(rg -l '(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)\s*[=:]\s*["'\''][^"'\'']{4,}' \
  --type-add 'config:yml,yaml,conf,ini,hcl' \
  -t config \
  "${PROJECT_ROOT}/docker/config/" 2> /dev/null |
  grep -v 'vault-config.hcl' | grep -v 'pg_hba.conf' || true)
if [ -n "$SECRET_IN_CONFIG" ]; then
  echo "$SECRET_IN_CONFIG" | while read -r f; do
    relpath="${f#${PROJECT_ROOT}/}"
    log_high "${relpath}: may contain hardcoded secret values"
  done
fi

# Check Cloudflare tunnel config doesn't expose Vault
CF_CONFIG="${PROJECT_ROOT}/docker/config/cloudflared/config.yml"
if [ -f "$CF_CONFIG" ]; then
  if grep -q '8200' "$CF_CONFIG" 2> /dev/null; then
    log_critical "cloudflared config.yml: Vault port (8200) should NOT be exposed via tunnel (§2.4)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
printf "  ${RED}Critical: %d${RESET}  ${RED}High: %d${RESET}  ${YELLOW}Medium: %d${RESET}  ${YELLOW}Low: %d${RESET}  (Total: %d)\n" \
  "$CRITICAL" "$HIGH" "$MEDIUM" "$LOW" "$TOTAL_FINDINGS"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"

if [ "$CRITICAL" -gt 0 ]; then
  echo -e "  ${RED}FAILED: ${CRITICAL} critical findings. Fix before deploying.${RESET}"
  exit 1
fi

echo -e "  ${GREEN}PASSED: No critical findings.${RESET}"
exit 0
