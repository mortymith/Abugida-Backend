#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Redis Firewall Rules — Host-level iptables (production only)
# Source: deployment.md v3.0.0 §7.2
#
# Invoked ONCE during prod provisioning (not on every deploy).
# Allows Redis traffic (6379, 26379) only from the backend subnet.
# All other sources are dropped.
#
# Usage:
#   sudo bash scripts/security/redis-firewall.sh install
#   sudo bash scripts/security/redis-firewall.sh teardown
#   sudo bash scripts/security/redis-firewall.sh status
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
REDIS_PORT=6379
SENTINEL_PORT=26379
# Backend subnet (ADR-004 Tier 2) — application services connect here
BACKEND_SUBNET="${BACKEND_SUBNET:-172.21.0.0/24}"
# Infrastructure subnet (ADR-004 Tier 3) — internal inter-service
INFRA_SUBNET="${INFRA_SUBNET:-172.22.0.0/24}"
CHAIN="REDIS_FIREWALL"

# ── Helpers ─────────────────────────────────────────────────────────
log_info() { echo "[INFO]  $*"; }
log_ok() { echo "[OK]    $*"; }
log_err() { echo "[ERROR] $*" >&2; }

# ── Ensure chain exists ─────────────────────────────────────────────
ensure_chain() {
  if ! iptables -L "${CHAIN}" -n > /dev/null 2>&1; then
    iptables -N "${CHAIN}"
    log_info "Created iptables chain: ${CHAIN}"
  fi
}

# ── Install rules ───────────────────────────────────────────────────
install_rules() {
  ensure_chain

  # Flush existing rules in chain (idempotent)
  iptables -F "${CHAIN}"

  # Allow from backend subnet (API, Dashboard workers connect to Redis)
  iptables -A "${CHAIN}" -s "${BACKEND_SUBNET}" -p tcp --dport "${REDIS_PORT}" -j ACCEPT -m comment --comment "redis-from-backend"
  iptables -A "${CHAIN}" -s "${BACKEND_SUBNET}" -p tcp --dport "${SENTINEL_PORT}" -j ACCEPT -m comment --comment "sentinel-from-backend"

  # Allow from infrastructure subnet (inter-Redis replication, Sentinel monitors)
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${REDIS_PORT}" -j ACCEPT -m comment --comment "redis-from-infra"
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${SENTINEL_PORT}" -j ACCEPT -m comment --comment "sentinel-from-infra"

  # Allow loopback (local diagnostics)
  iptables -A "${CHAIN}" -s 127.0.0.1/8 -p tcp --dport "${REDIS_PORT}" -j ACCEPT -m comment --comment "redis-localhost"
  iptables -A "${CHAIN}" -s 127.0.0.1/8 -p tcp --dport "${SENTINEL_PORT}" -j ACCEPT -m comment --comment "sentinel-localhost"

  # Drop everything else
  iptables -A "${CHAIN}" -p tcp --dport "${REDIS_PORT}" -j DROP -m comment --comment "redis-drop-other"
  iptables -A "${CHAIN}" -p tcp --dport "${SENTINEL_PORT}" -j DROP -m comment --comment "sentinel-drop-other"

  # Hook into INPUT chain (idempotent: remove first to avoid duplicates)
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -I INPUT -j "${CHAIN}"

  log_ok "Redis firewall rules installed."
  log_ok "  Redis (6379)  allowed from: ${BACKEND_SUBNET}, ${INFRA_SUBNET}, 127.0.0.1/8"
  log_ok "  Sentinel (26379) allowed from: ${BACKEND_SUBNET}, ${INFRA_SUBNET}, 127.0.0.1/8"
}

# ── Teardown rules ──────────────────────────────────────────────────
teardown_rules() {
  # Unhook from INPUT
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  # Flush and delete chain
  iptables -F "${CHAIN}" 2> /dev/null || true
  iptables -X "${CHAIN}" 2> /dev/null || true
  log_ok "Redis firewall rules removed."
}

# ── Status ──────────────────────────────────────────────────────────
show_status() {
  if iptables -L "${CHAIN}" -n -v 2> /dev/null; then
    log_ok "Chain ${CHAIN} is active."
  else
    log_info "Chain ${CHAIN} does not exist. Firewall not active."
  fi
}

# ── Main ────────────────────────────────────────────────────────────
case "${1:-status}" in
install) install_rules ;;
teardown) teardown_rules ;;
status) show_status ;;
*)
  echo "Usage: $0 {install|teardown|status}"
  echo ""
  echo "  install   — Create and hook iptables rules (run as root)"
  echo "  teardown  — Remove all Redis firewall rules"
  echo "  status    — Show current rules"
  exit 1
  ;;
esac
