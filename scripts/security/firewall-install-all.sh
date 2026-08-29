#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Full Infrastructure Firewall Segmentation (production only)
# Source: deployment.md v3.0.0 §7, ADR-004
#
# Installs ALL service firewall rules:
#   - Redis (6379, 26379)
#   - PostgreSQL (5432) + PgBouncer (6432)
#   - Vault (8200, 8201)
#   - Cross-tier blocking (infra→edge, edge→infra)
#
# Network segmentation (ADR-004):
#   Edge (172.20.0.0/24) → can reach Backend only
#   Backend (172.21.0.0/24) → can reach Infra (data layer)
#   Infra (172.22.0.0/24) → CANNOT reach Edge (internal: true)
#
# Usage:
#   sudo bash scripts/security/firewall-install-all.sh install
#   sudo bash scripts/security/firewall-install-all.sh teardown
#   sudo bash scripts/security/firewall-install-all.sh status
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ── Subnets (ADR-004) ─────────────────────────────────────────────
EDGE_SUBNET="${EDGE_SUBNET:-172.20.0.0/24}"
BACKEND_SUBNET="${BACKEND_SUBNET:-172.21.0.0/24}"
INFRA_SUBNET="${INFRA_SUBNET:-172.22.0.0/24}"
CHAIN="INFRA_SEGMENT"

# ── Helpers ────────────────────────────────────────────────────────
log_info() { echo "[INFO]  $*"; }
log_ok() { echo "[OK]    $*"; }

# ── Cross-tier segmentation ────────────────────────────────────────
install_cross_tier() {
  # Infrastructure cannot initiate connections to Edge
  # (Docker internal: true already blocks this at network level,
  #  but we add host-level defense-in-depth)
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -d "${EDGE_SUBNET}" -j DROP -m comment --comment "infra-to-edge-blocked"

  # Edge cannot reach Infrastructure directly (must go via Backend services)
  # Note: Docker Compose network topology already enforces this for most cases,
  # but Caddy is on the edge network and could theoretically route to infra IPs
  iptables -A "${CHAIN}" -s "${EDGE_SUBNET}" -d "${INFRA_SUBNET}" -j DROP -m comment --comment "edge-to-infra-blocked"

  log_ok "Cross-tier segmentation rules installed."
  log_ok "  ${INFRA_SUBNET} → ${EDGE_SUBNET}: BLOCKED"
  log_ok "  ${EDGE_SUBNET} → ${INFRA_SUBNET}: BLOCKED"
}

# ── Main ────────────────────────────────────────────────────────────
case "${1:-status}" in
install)
  echo "═══════════════════════════════════════════════════════════"
  echo "  Installing Full Infrastructure Firewall"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  # Install per-service firewalls
  echo "── Redis ──"
  bash "${PROJECT_ROOT}/scripts/security/redis-firewall.sh" install
  echo ""

  echo "── PostgreSQL ──"
  bash "${PROJECT_ROOT}/scripts/security/postgres-firewall.sh" install
  echo ""

  echo "── Vault ──"
  bash "${PROJECT_ROOT}/scripts/security/vault-firewall.sh" install
  echo ""

  # Install cross-tier segmentation
  if ! iptables -L "${CHAIN}" -n > /dev/null 2>&1; then
    iptables -N "${CHAIN}"
  fi
  iptables -F "${CHAIN}"
  install_cross_tier
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -I INPUT -j "${CHAIN}"
  echo ""

  echo "═══════════════════════════════════════════════════════════"
  echo "  All firewall rules installed successfully."
  echo "═══════════════════════════════════════════════════════════"
  ;;

teardown)
  echo "Removing all infrastructure firewall rules..."
  bash "${PROJECT_ROOT}/scripts/security/redis-firewall.sh" teardown 2> /dev/null || true
  bash "${PROJECT_ROOT}/scripts/security/postgres-firewall.sh" teardown 2> /dev/null || true
  bash "${PROJECT_ROOT}/scripts/security/vault-firewall.sh" teardown 2> /dev/null || true
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -F "${CHAIN}" 2> /dev/null || true
  iptables -X "${CHAIN}" 2> /dev/null || true
  echo "All firewall rules removed."
  ;;

status)
  echo "── Cross-tier Segmentation ──"
  if iptables -L "${CHAIN}" -n -v 2> /dev/null; then
    log_ok "Chain ${CHAIN} is active."
  else
    log_info "Chain ${CHAIN} does not exist."
  fi
  echo ""
  echo "── Redis ──"
  bash "${PROJECT_ROOT}/scripts/security/redis-firewall.sh" status 2> /dev/null || true
  echo ""
  echo "── PostgreSQL ──"
  bash "${PROJECT_ROOT}/scripts/security/postgres-firewall.sh" status 2> /dev/null || true
  echo ""
  echo "── Vault ──"
  bash "${PROJECT_ROOT}/scripts/security/vault-firewall.sh" status 2> /dev/null || true
  ;;

*)
  echo "Usage: $0 {install|teardown|status}"
  exit 1
  ;;
esac
