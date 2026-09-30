#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Application HTTP Health Probes
# ADR-009
#
# Single implementation behind `just health-api|health-dashboard|
# health-marketing`. Probes the same endpoints the app images declare in
# their compose healthchecks, from the host, with a short timeout.
#
# Usage:
#   bash scripts/monitoring/http-health.sh <api|dashboard|marketing> [--strict]
#
#   --strict  exit non-zero when any probe fails (for gating deploys/CI)
#
# Ports come from the environment, falling back to .env, then to the
# base.yml defaults.
#
# Exit codes: 0 = healthy (or non-strict), 1 = at least one failed probe
# (strict), 64 = bad usage.
# ════════════════════════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

PROBE_TIMEOUT="${PROBE_TIMEOUT:-5}"

TARGET="${1:-}"
STRICT="false"
for arg in "${@:2}"; do
  case "${arg}" in
  --strict) STRICT="true" ;;
  *)
    echo "usage: $(basename "$0") <api|dashboard|marketing> [--strict]" >&2
    exit 64
    ;;
  esac
done

require_cmd curl "install curl (apt-get install curl / brew install curl)"

# ─── Probe table: name<TAB>path<TAB>port key<TAB>port default ────────
case "${TARGET}" in
api)
  API_PORT="$(env_or_dotenv API_PORT 3001)"
  API_BASE="http://localhost:${API_PORT}"
  LABELS=("/health|liveness" "/db-health|database")
  ;;
dashboard)
  DASHBOARD_PORT="$(env_or_dotenv DASHBOARD_PORT 8081)"
  API_BASE="http://localhost:${DASHBOARD_PORT}"
  LABELS=("/health|liveness")
  ;;
marketing)
  MARKETING_PORT="$(env_or_dotenv MARKETING_PORT 8082)"
  API_BASE="http://localhost:${MARKETING_PORT}"
  LABELS=("/health|liveness")
  ;;
*)
  echo "usage: $(basename "$0") <api|dashboard|marketing> [--strict]" >&2
  exit 64
  ;;
esac

# ─── Probe ──────────────────────────────────────────────────────────
failures=0

for label in "${LABELS[@]}"; do
  path="${label%%|*}"
  name="${label##*|}"
  printf '  %s %s ' "── GET ${path}" "[${name}]"

  if body="$(curl -sf --max-time "${PROBE_TIMEOUT}" "${API_BASE}${path}" 2>&1)"; then
    echo "OK${body:+ → ${body}}"
  else
    failures=$((failures + 1))
    echo "(not reachable)"
  fi
done

if [ "${failures}" -gt 0 ] && [ "${STRICT}" = "true" ]; then
  log_err "${failures} probe(s) failed for ${TARGET}"
  exit 1
fi
exit 0
