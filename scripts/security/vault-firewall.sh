#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Vault Firewall Rules — Host-level iptables (production only)
# Source: deployment.md v3.0.0 §7, ADR-004, §2.4
#
# Vault (8200) must ONLY be reachable from:
#   - Infrastructure subnet (API/Dashboard apps fetch secrets at startup)
#   - Loopback (local admin, init scripts)
#
# IMPORTANT (§2.4): Vault UI must NOT be exposed via Cloudflare Tunnel.
# Vault is internal-only. Confirm tunnel config excludes port 8200.
#
# Usage:
#   sudo bash scripts/security/vault-firewall.sh install
#   sudo bash scripts/security/vault-firewall.sh teardown
#   sudo bash scripts/security/vault-firewall.sh status
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
VAULT_PORT=8200
CLUSTER_PORT=8201
# Infrastructure subnet (ADR-004 Tier 3) — only infra can reach Vault
INFRA_SUBNET="${INFRA_SUBNET:-172.22.0.0/24}"
CHAIN="VAULT_FIREWALL"

# ── Helpers ─────────────────────────────────────────────────────────
log_info() { echo "[INFO]  $*"; }
log_ok() { echo "[OK]    $*"; }

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
  iptables -F "${CHAIN}"

  # Allow from infrastructure subnet only
  # (API and Dashboard containers are multi-homed: backend + infrastructure)
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${VAULT_PORT}" -j ACCEPT -m comment --comment "vault-api-from-infra"
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${CLUSTER_PORT}" -j ACCEPT -m comment --comment "vault-cluster-from-infra"

  # Allow loopback (vault-init, vault-unseal scripts)
  iptables -A "${CHAIN}" -s 127.0.0.1/8 -p tcp --dport "${VAULT_PORT}" -j ACCEPT -m comment --comment "vault-localhost"
  iptables -A "${CHAIN}" -s 127.0.0.1/8 -p tcp --dport "${CLUSTER_PORT}" -j ACCEPT -m comment --comment "vault-cluster-localhost"

  # CRITICAL: Block backend subnet from reaching Vault directly
  # Backend services must go through infrastructure network (multi-homed)
  BACKEND_SUBNET="${BACKEND_SUBNET:-172.21.0.0/24}"
  iptables -A "${CHAIN}" -s "${BACKEND_SUBNET}" -p tcp --dport "${VAULT_PORT}" -j DROP -m comment --comment "vault-block-backend"
  iptables -A "${CHAIN}" -s "${BACKEND_SUBNET}" -p tcp --dport "${CLUSTER_PORT}" -j DROP -m comment --comment "vault-block-backend-cluster"

  # CRITICAL: Block edge subnet entirely
  EDGE_SUBNET="${EDGE_SUBNET:-172.20.0.0/24}"
  iptables -A "${CHAIN}" -s "${EDGE_SUBNET}" -p tcp --dport "${VAULT_PORT}" -j DROP -m comment --comment "vault-block-edge"
  iptables -A "${CHAIN}" -s "${EDGE_SUBNET}" -p tcp --dport "${CLUSTER_PORT}" -j DROP -m comment --comment "vault-block-edge-cluster"

  # Drop everything else
  iptables -A "${CHAIN}" -p tcp --dport "${VAULT_PORT}" -j DROP -m comment --comment "vault-drop-other"
  iptables -A "${CHAIN}" -p tcp --dport "${CLUSTER_PORT}" -j DROP -m comment --comment "vault-cluster-drop-other"

  # Hook into INPUT chain (idempotent)
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -I INPUT -j "${CHAIN}"

  log_ok "Vault firewall rules installed."
  log_ok "  Vault API (8200)    allowed from: ${INFRA_SUBNET}, 127.0.0.1/8"
  log_ok "  Vault Cluster (8201) allowed from: ${INFRA_SUBNET}, 127.0.0.1/8"
  log_ok "  BLOCKED from: ${BACKEND_SUBNET}, ${EDGE_SUBNET}"
}

# ── Teardown rules ──────────────────────────────────────────────────
teardown_rules() {
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -F "${CHAIN}" 2> /dev/null || true
  iptables -X "${CHAIN}" 2> /dev/null || true
  log_ok "Vault firewall rules removed."
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
  exit 1
  ;;
esac
