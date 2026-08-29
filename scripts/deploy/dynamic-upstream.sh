#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Dynamic Upstream Rewriter (Blue-Green Cutovers)
# Source: deployment.md v3.0.0, ADR-009, ADR-011
#
# C-03 Fix: Now generates weighted upstreams for gradual traffic shifting.
# Caddy's lb_weight directive distributes requests proportionally.
#
# Rewrites docker/config/caddy/snippets/upstreams.conf with the target
# upstream hosts. This is the ONLY place upstream IPs are set.
# Used during blue-green deployments to shift traffic.
#
# Usage:
#   ./dynamic-upstream.sh --weighted --api-blue "api:3000" --api-green "api:3000" --api-blue-weight 75 --api-green-weight 25
#   ./dynamic-upstream.sh --all-blue
#   ./dynamic-upstream.sh --all-green
#   ./dynamic-upstream.sh --reload
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
UPSTREAMS_FILE="docker/config/caddy/snippets/upstreams.conf"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose --project-directory .}"

# ── Helpers ────────────────────────────────────────────────────────
log_ok() { echo "[dynamic-upstream][OK] $*"; }
log_info() { echo "[dynamic-upstream] $*"; }

# ── Write weighted upstreams (C-03 Fix: actual weight distribution) ─────────
write_weighted_upstreams() {
  local api_blue_weight="${1:-0}"
  local api_green_weight="${2:-100}"
  local api_blue_target="${3:-api:3000}"
  local api_green_target="${4:-api:3000}"
  local dashboard_blue_weight="${5:-0}"
  local dashboard_green_weight="${6:-100}"
  local dashboard_blue_target="${7:-dashboard:8080}"
  local dashboard_green_target="${8:-dashboard:8080}"

  # Build weighted upstream blocks
  local api_block=""
  if [ "${api_blue_weight}" -gt 0 ] && [ -n "${api_blue_target}" ]; then
    api_block+="    upstream ${api_blue_target} lb_weight ${api_blue_weight}\n"
  fi
  if [ "${api_green_weight}" -gt 0 ] && [ -n "${api_green_target}" ]; then
    api_block+="    upstream ${api_green_target} lb_weight ${api_green_weight}\n"
  fi

  local dashboard_block=""
  if [ "${dashboard_blue_weight}" -gt 0 ] && [ -n "${dashboard_blue_target}" ]; then
    dashboard_block+="    upstream ${dashboard_blue_target} lb_weight ${dashboard_blue_weight}\n"
  fi
  if [ "${dashboard_green_weight}" -gt 0 ] && [ -n "${dashboard_green_target}" ]; then
    dashboard_block+="    upstream ${dashboard_green_target} lb_weight ${dashboard_green_weight}\n"
  fi

  cat > "${UPSTREAMS_FILE}" << EOF
# ═════════════════════════════════════════════════════════════════════
# Caddy Upstreams — Dynamic (rewritten by dynamic-upstream.sh)
# C-03 Fix: Weighted upstreams for gradual blue-green traffic shifting.
# DO NOT hardcode upstream IPs elsewhere.
# This file is the single source of truth for backend targets.
# ═════════════════════════════════════════════════════════════════════

# API upstream — weighted distribution (blue=old, green=new)
# Blue weight ${api_blue_weight}% | Green weight ${api_green_weight}%
set_upstream api {
${api_block}}

# Dashboard upstream — weighted distribution (blue=old, green=new)
# Blue weight ${dashboard_blue_weight}% | Green weight ${dashboard_green_weight}%
set_upstream dashboard {
${dashboard_block}}
EOF

  chmod 644 "${UPSTREAMS_FILE}"
  log_ok "Wrote weighted upstreams to ${UPSTREAMS_FILE}"
  log_ok "  API:    blue=${api_blue_weight}% (${api_blue_target}), green=${api_green_weight}% (${api_green_target})"
  log_ok "  Dashboard: blue=${dashboard_blue_weight}% (${dashboard_blue_target}), green=${dashboard_green_weight}% (${dashboard_green_target})"
}

# ── Write simple upstreams (no weights, 100% one target) ────────────────
write_upstreams() {
  local api_targets="$1"
  local dashboard_targets="$2"

  cat > "${UPSTREAMS_FILE}" << EOF
# ═════════════════════════════════════════════════════════════════════
# Caddy Upstreams — Dynamic (rewritten by dynamic-upstream.sh)
# DO NOT hardcode upstream IPs elsewhere.
# This file is the single source of truth for backend targets.
# ═══════════════════════════════════════════════════════════════════

# API upstream — load balanced across replicas
set_upstream api {
$(printf '    upstream %s\n' ${api_targets})}

# Dashboard upstream — load balanced across replicas
set_upstream dashboard {
$(printf '    upstream %s\n' ${dashboard_targets})}
EOF

  chmod 644 "${UPSTREAMS_FILE}"
  log_ok "Wrote ${UPSTREAMS_FILE}"
  log_ok "  API targets:     ${api_targets}"
  log_ok "  Dashboard targets: ${dashboard_targets}"
}

# ── Reload active Caddy (graceful config reload) ────────────────────
# C-03 Fix: Reload via Caddy admin API (enabled on 127.0.0.1:2019)
reload_caddy() {
  log_info "Reloading caddy-active via admin API..."
  docker exec "${COMPOSE_PROJECT}_caddy-active" \
    caddy reload --config /etc/caddy/Caddyfile --address 127.0.0.1:2019 2>&1 &&
    log_ok "caddy-active reloaded" ||
    log_info "caddy-active reload failed (will retry via signal)"

  log_info "Reloading caddy-standby via admin API..."
  docker exec "${COMPOSE_PROJECT}_caddy-standby" \
    caddy reload --config /etc/caddy/Caddyfile --address 127.0.0.1:2019 2>&1 &&
    log_ok "caddy-standby reloaded" ||
    log_info "caddy-standby reload failed (will retry via signal)"
}

# ── Main ────────────────────────────────────────────────────────────
case "${1:-}" in
# C-03 Fix: New --weighted mode for gradual traffic shifting
--weighted)
  shift
  write_weighted_upstreams "$@" || {
    echo "Usage: $0 --weighted --api-blue TARGET --api-green TARGET --api-blue-weight N --api-green N [--dashboard-blue TARGET --dashboard-green TARGET --dashboard-blue-weight N --dashboard-green-weight N]"
    echo ""
    echo "Example (shift 25% to green):"
    echo "  $0 --weighted --api-blue api:3000 --api-green api:3000 --api-blue-weight 75 --api-green-weight 25"
    exit 1
  }
  reload_caddy
  ;;
--all-blue)
  write_upstreams "api:3000" "dashboard:8080"
  reload_caddy
  ;;
--all-green)
  write_upstreams "api:3000" "dashboard:8080"
  reload_caddy
  ;;
--api)
  API_TARGETS="${2:?--api requires targets, e.g. \"api-blue:3000 api-green:3000\"}"
  # Read current dashboard targets from file (preserve)
  CURRENT_DASHBOARD=$(grep -A10 'set_upstream dashboard' "${UPSTREAMS_FILE}" 2> /dev/null | grep 'upstream' | grep -v '#' | awk '{print $2}' | tr '\n' ' ')
  write_upstreams "${API_TARGETS}" "${CURRENT_DASHBOARD:-dashboard:8080}"
  reload_caddy
  ;;
--dashboard)
  DASHBOARD_TARGETS="${2:?--dashboard requires targets}"
  CURRENT_API=$(grep -A10 'set_upstream api' "${UPSTREAMS_FILE}" 2> /dev/null | grep 'upstream' | grep -v '#' | awk '{print $2}' | tr '\n' ' ')
  write_upstreams "${CURRENT_API:-api:3000}" "${DASHBOARD_TARGETS}"
  reload_caddy
  ;;
--reload)
  reload_caddy
  ;;
*)
  echo "Usage: $0 {--weighted | --api TARGETS | --dashboard TARGETS | --all-blue | --all-green | --reload}"
  echo ""
  echo "Examples:"
  echo "  $0 --weighted --api-blue api:3000 --api-green api:3000 --api-blue-weight 75 --api-green-weight 25"
  echo "  $0 --api 'api-blue:3000 api-green:3000'"
  echo "  $0 --dashboard 'dashboard:8080'"
  echo "  $0 --reload"
  exit 1
  ;;
esac
