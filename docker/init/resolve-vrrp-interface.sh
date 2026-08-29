#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# Phase 8 Fix — Resolve VRRP_INTERFACE from Docker network
# ════════════════════════════════════════════════════════════════
#
# In production, Keepalived uses host networking (--network host).
# This script resolves the actual Docker bridge interface name for the
# edge network and generates a keepalived.conf with the correct
# interface name.
#
# Usage:
#   bash docker/init/resolve-vrrp-interface.sh          # Resolve and generate config
#   bash docker/init/resolve-vrrp-interface.sh --check    # Verify current config
# ═════════════════════════════════════════════════════════════════
set -euo pipefail

EDGE_NETWORK="${COMPOSE_PROJECT_NAME:-infra}_edge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
KEEPALIVED_CONF="${PROJECT_ROOT}/docker/config/keepalived/keepalived.conf"
KEEPALIVED_CONF_TEMPLATE="${PROJECT_ROOT}/docker/config/keepalived/keepalived.conf.template"

log_ok() { echo "[resolve-vrrp] $*"; }
log_warn() { echo "[resolve-vrrp][WARN] $*"; }
log_fail() {
  echo "[resolve-vrrp][ERROR] $*"
  exit 1
}

resolve_interface() {
  # Get the bridge interface name for the edge network
  BRIDGE_IFACE=$(docker network inspect "${EDGE_NETWORK}" \
    --format '{{.IPAM.Config[0].Gateway}}' 2> /dev/null || true)
  if [ -z "${BRIDGE_IFACE}" ]; then
    log_fail "Could not resolve bridge interface for network ${EDGE_NETWORK}"
  fi
  echo "${BRIDGE_IFACE}"
}
verify_config() {
  if [ ! -f "${KEEPALIVED_CONF}" ]; then
    log_fail "keepalived.conf not found"
  fi
  if grep -q 'VRRP_INTERFACE:-' "${KEEPALIVED_CONF}" 2> /dev/null; then
    log_warn "VRRP_INTERFACE is not yet parameterized (still set to placeholder)"
    return 1
  fi
  # Verify interface exists on host
  RESOLVED_IFACE=$(grep '^interface' "${KEEPALIVED_CONF}" 2> /dev/null | head -1 | awk '{print $2}' || echo '')
  if [ -z "${RESOLVED_IFACE}" ]; then
    log_fail "VRRP_INTERFACE not set in keepalived.conf"
  fi
  ip link show "${RESOLVED_IFACE}" > /dev/null 2>&1 || {
    log_fail "Interface ${RESOLVED_IFACE} does not exist on this host"
  }
  log_ok "Interface ${RESOLVED_IFACE} exists and is valid"
  return 0
}
generate_config() {
  local interface="$1"
  local auth_pass="$2"
  RESOLVED_INTERFACE=$(resolve_interface)
  auth_pass="${auth_pass:-$(openssl rand -hex 12)}"
  sed -e "s|\${VRRP_INTERFACE:-eth0}|${RESOLVED_INTERFACE}|g" \
    -e "s|KEEPALIVED_AUTH_PASS_REPLACE|${auth_pass}|g" \
    "${KEEPALIVED_CONF_TEMPLATE}" > "${KEEPALIVED_CONF}"
  log_ok "Generated keepalived.conf with interface=${RESOLVED_INTERFACE}"
}
# ── Main ────────────────────────────────────────────────────
case "${1:-}" in
--check)
  verify_config
  ;;
--generate)
  generate_config "" "$(openssl rand -hex 12)"
  ;;
*)
  echo "Usage: $0 [--check | --generate]"
  echo "  --check   Verify current keepalived.conf"
  echo "  --generate  Resolve interface and generate config"
  exit 1
  ;;
esac
