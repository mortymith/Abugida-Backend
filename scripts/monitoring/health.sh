#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Endpoint-Level Service Health Check
# ADR-009 (modular compose topology)
#
# Probes each service the same way its own compose healthcheck does —
# authenticated Redis PING, PowerSync /probes/liveness, MinIO live
# endpoint — instead of trusting Docker health state alone.
# Complements scripts/monitoring/check-all-services.sh (Docker state).
#
# Usage:
#   bash scripts/monitoring/health.sh           # all sections; absent
#                                               # services reported as skip
#   bash scripts/monitoring/health.sh --core    # core infrastructure only
#   bash scripts/monitoring/health.sh --json    # TSV: name<TAB>status<TAB>ms
#
# Ports and credentials come from the environment, falling back to
# .env (same precedence as scripts/backup/backup-postgres.sh).
#
# Exit codes: 0 = all probed services healthy, 1 = at least one failure.
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
ENV_FILE="${ENV_FILE:-.env}"
PROBE_TIMEOUT=5 # seconds

MODE="all"
for arg in "$@"; do
  case "${arg}" in
  --core) MODE="core" ;;
  --json) MODE="json" ;;
  *)
    echo "usage: $(basename "$0") [--core] [--json]" >&2
    exit 64
    ;;
  esac
done

# ─── Config resolution (env var → .env → default) ─────────────────────
env_or_dotenv() {
  local key="$1" default="$2"
  local val
  val=$(printenv "${key}" 2> /dev/null || true)
  if [ -z "${val}" ] && [ -f "${ENV_FILE}" ]; then
    val=$(grep -E "^${key}=" "${ENV_FILE}" 2> /dev/null | head -1 | cut -d'=' -f2- || true)
    val="${val%\"}"
    val="${val#\"}"
  fi
  printf '%s' "${val:-${default}}"
}

POSTGRES_USER_VAL=$(env_or_dotenv POSTGRES_USER app)
POSTGRES_DB_VAL=$(env_or_dotenv POSTGRES_DB app)
PGBOUNCER_PORT_VAL=$(env_or_dotenv PGBOUNCER_PORT 6432)
MINIO_API_PORT_VAL=$(env_or_dotenv MINIO_API_PORT 9000)
POWERSYNC_PORT_VAL=$(env_or_dotenv POWERSYNC_PORT 8085)
API_PORT_VAL=$(env_or_dotenv API_PORT 3001)
DASHBOARD_PORT_VAL=$(env_or_dotenv DASHBOARD_PORT 8081)
MARKETING_PORT_VAL=$(env_or_dotenv MARKETING_PORT 8082)
VAULT_API_PORT_VAL=$(env_or_dotenv VAULT_API_PORT 8200)

# ─── Output helpers ───────────────────────────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  # ANSI-C quoting stores real escape bytes, so plain %s renders color.
  GREEN=$'\033[0;32m'
  RED=$'\033[0;31m'
  DIM=$'\033[2m'
  BOLD=$'\033[1m'
  RESET=$'\033[0m'
else
  GREEN='' RED='' DIM='' BOLD='' RESET=''
fi

OK_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

section() {
  [ "${MODE}" = "json" ] && return 0
  printf '\n%s%s%s\n' "${BOLD}" "$1" "${RESET}"
}

report() { # report <name> <ok|FAIL|skip> <detail> <ms>
  local name="$1" status="$2" detail="$3" ms="$4"
  case "${status}" in
  ok) OK_COUNT=$((OK_COUNT + 1)) ;;
  FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  *) SKIP_COUNT=$((SKIP_COUNT + 1)) ;;
  esac
  if [ "${MODE}" = "json" ]; then
    printf '%s\t%s\t%s\n' "${name}" "${status}" "${ms}"
    return 0
  fi
  local label color
  case "${status}" in
  ok) label='  ok' color="${GREEN}" ;;
  FAIL) label='FAIL' color="${RED}" ;;
  *) label=' skip' color="${DIM}" ;;
  esac
  detail=${detail//$'\n'/ }
  detail=${detail#"${detail%%[![:space:]]*}"} # ltrim
  detail=${detail%"${detail##*[![:space:]]}"} # rtrim
  [ ${#detail} -gt 52 ] && detail="${detail:0:51}…"
  printf ' %b%s%b  %-22s  %-52s  %s\n' \
    "${color}" "${label}" "${RESET}" "${name}" "${detail}" "${ms}"
}

container_running() {
  # Explicit container_name (compose v1 style: project_service) or the
  # compose v2 auto name (project-service-<scale>).
  docker ps --format '{{.Names}}' 2> /dev/null |
    grep -Eq "^${COMPOSE_PROJECT}_$1$|^${COMPOSE_PROJECT}-$1(-[0-9]+)?$"
}

# ─── Probe runner (measures latency, isolates failures) ───────────────
run_probe() { # run_probe <name> <container-or-"-"> <probe-fn>
  local name="$1" container="$2" fn="$3" out ms start end status
  if [ "${container}" != "-" ] && ! container_running "${container}"; then
    report "${name}" skip "container not running" "--"
    return 0
  fi
  start=$(date +%s%3N)
  if out=$("${fn}" 2>&1); then
    status=ok
  else
    status=FAIL
    # Keep the most informative line (first non-empty).
    out=$(printf '%s\n' "${out}" | grep -m1 -v '^$' || echo "probe failed")
  fi
  end=$(date +%s%3N)
  ms="$((end - start))ms"
  [ "${ms}" = "0ms" ] && ms="<1ms"
  report "${name}" "${status}" "${out}" "${ms}"
  [ "${status}" = "ok" ]
}

# ─── Probes (mirror each service's compose healthcheck) ───────────────
probe_postgres() {
  timeout "${PROBE_TIMEOUT}" docker exec "${COMPOSE_PROJECT}_postgres-primary" \
    pg_isready -U "${POSTGRES_USER_VAL}" -d "${POSTGRES_DB_VAL}"
}

probe_pgbouncer() {
  timeout "${PROBE_TIMEOUT}" docker exec "${COMPOSE_PROJECT}_pgbouncer" \
    pg_isready -h 127.0.0.1 -p "${PGBOUNCER_PORT_VAL}"
}

probe_redis() {
  # Credentials come from the container env (base.yml injects REDIS_PASSWORD);
  # matches the ACL setup where the default user is disabled.
  local out
  out=$(timeout "${PROBE_TIMEOUT}" docker exec "${COMPOSE_PROJECT}_redis-primary" sh -c \
    'exec redis-cli --no-auth-warning -u "redis://app:$REDIS_PASSWORD@127.0.0.1:6379" ping') ||
    {
      echo "${out:-authentication/connection failed}"
      return 1
    }
  [ "${out}" = "PONG" ] || {
    echo "unexpected reply: ${out:-<empty>}"
    return 1
  }
  echo "PONG (authenticated as app)"
}

probe_minio() {
  timeout "${PROBE_TIMEOUT}" curl -sf -o /dev/null \
    "http://localhost:${MINIO_API_PORT_VAL}/minio/health/live" &&
    echo "live endpoint responding" ||
    {
      echo "GET /minio/health/live failed"
      return 1
    }
}

probe_powersync() {
  local body code payload
  body=$(timeout "${PROBE_TIMEOUT}" curl -sf -w '\n%{http_code}' \
    "http://localhost:${POWERSYNC_PORT_VAL}/probes/liveness") || {
    echo "GET /probes/liveness failed"
    return 1
  }
  code=${body##*$'\n'}
  payload=${body%$'\n'*}
  if grep -q '"ready"[[:space:]]*:[[:space:]]*true' <<< "${payload}"; then
    echo "HTTP ${code} ready=true"
  else
    echo "HTTP ${code} ready=false"
    return 1
  fi
}

probe_http_health() { # <name> <port> — shared by api / dashboard / marketing
  local name="$1" port="$2" body
  body=$(timeout "${PROBE_TIMEOUT}" curl -sf "http://localhost:${port}/health") || {
    echo "GET /${name}/health failed"
    return 1
  }
  echo "${body:-HTTP 200}" # show payload (e.g. {"status":"ok"})
}

probe_api() {
  probe_http_health api "${API_PORT_VAL}"
}

probe_dashboard() {
  probe_http_health dashboard "${DASHBOARD_PORT_VAL}"
}

probe_marketing() {
  probe_http_health marketing "${MARKETING_PORT_VAL}"
}

probe_otel() {
  # signoz-otel-collector image ships bash but no wget — probe the
  # health extension via /dev/tcp.
  timeout "${PROBE_TIMEOUT}" docker exec "${COMPOSE_PROJECT}_otel-collector" \
    bash -c 'echo > /dev/tcp/127.0.0.1/13133' > /dev/null 2>&1 &&
    echo "health extension responding" ||
    {
      echo "collector :13133 not responding"
      return 1
    }
}

probe_signoz() {
  # Consolidated SigNoz serves UI + API on :8080.
  timeout "${PROBE_TIMEOUT}" docker exec "${COMPOSE_PROJECT}_signoz-frontend" \
    wget -qO- http://localhost:8080/api/v1/health > /dev/null &&
    echo "API responding" ||
    {
      echo "signoz :8080 not responding"
      return 1
    }
}

probe_clickhouse() {
  local ch_client=(clickhouse-client)
  [ -n "${CLICKHOUSE_PASSWORD:-}" ] && ch_client+=(--password "${CLICKHOUSE_PASSWORD}")
  [ "$(timeout "${PROBE_TIMEOUT}" docker exec "${COMPOSE_PROJECT}_clickhouse" \
    "${ch_client[@]}" --query 'SELECT 1')" = "1" ] &&
    echo "SELECT 1 → 1" ||
    {
      echo "query failed"
      return 1
    }
}

probe_vault() {
  # Vault answers /v1/sys/health with distinct codes per state; any HTTP
  # response proves reachability, the code carries the seal state.
  local code
  code=$(timeout "${PROBE_TIMEOUT}" curl -sk -o /dev/null -w '%{http_code}' \
    "https://localhost:${VAULT_API_PORT_VAL}/v1/sys/health") || {
    echo "not responding"
    return 1
  }
  case "${code}" in
  200) echo "HTTP 200 (unsealed, active)" ;;
  429) echo "HTTP 429 (unsealed, standby)" ;;
  472) echo "HTTP 472 (recovery mode)" ;;
  501) echo "HTTP 501 (uninitialized)" ;;
  503) echo "HTTP 503 (sealed)" ;;
  *) echo "HTTP ${code}" ;;
  esac
}

# ─── Main ─────────────────────────────────────────────────────────────
if [ "${MODE}" != "json" ]; then
  printf '%sService Health — project=%s%s\n' "${BOLD}" "${COMPOSE_PROJECT}" "${RESET}"
fi

section "Core Infrastructure"
run_probe postgres-primary postgres-primary probe_postgres || true
run_probe pgbouncer pgbouncer probe_pgbouncer || true
run_probe redis-primary redis-primary probe_redis || true
run_probe minio minio probe_minio || true
run_probe powersync-api powersync-api probe_powersync || true

if [ "${MODE}" != "core" ]; then
  section "Applications"
  run_probe api api probe_api || true
  run_probe dashboard dashboard probe_dashboard || true
  run_probe marketing marketing probe_marketing || true

  section "Observability & Security"
  run_probe otel-collector otel-collector probe_otel || true
  run_probe signoz-frontend signoz-frontend probe_signoz || true
  run_probe clickhouse clickhouse probe_clickhouse || true
  run_probe vault vault probe_vault || true
fi

if [ "${MODE}" = "json" ]; then
  exit 0
fi

TOTAL=$((OK_COUNT + FAIL_COUNT))
if [ "${TOTAL}" -eq 0 ]; then
  printf '\n%sNo services running — is the environment up?%s\n' "${RED}" "${RESET}\n"
  exit 1
fi

printf '\n%sSummary:%s  %b%d ok%b  %b%d failed%b  %d skipped\n' \
  "${BOLD}" "${RESET}" \
  "${GREEN}" "${OK_COUNT}" "${RESET}" \
  "${RED}" "${FAIL_COUNT}" "${RESET}" \
  "${SKIP_COUNT}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  exit 1
fi
exit 0
