#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# PostgreSQL Firewall Rules — Host-level iptables (production only)
# Source: deployment.md v3.0.0 §7, ADR-004
#
# Allows PostgreSQL (5432) and PgBouncer (6432) traffic ONLY from:
#   - Backend subnet (API + Dashboard — via PgBouncer per ADR-019)
#   - Infrastructure subnet (replication, PgBouncer→primary)
#   - Loopback (local diagnostics)
# All other sources are dropped.
#
# Usage:
#   sudo bash scripts/security/postgres-firewall.sh install
#   sudo bash scripts/security/postgres-firewall.sh teardown
#   sudo bash scripts/security/postgres-firewall.sh status
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
PG_PORT=5432
PGB_PORT=6432
# Backend subnet (ADR-004 Tier 2)
BACKEND_SUBNET="${BACKEND_SUBNET:-172.21.0.0/24}"
# Infrastructure subnet (ADR-004 Tier 3)
INFRA_SUBNET="${INFRA_SUBNET:-172.22.0.0/24}"
CHAIN="PG_FIREWALL"

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

  # Flush existing rules in chain (idempotent)
  iptables -F "${CHAIN}"

  # Allow from backend subnet (API + Dashboard connect via PgBouncer per ADR-019)
  iptables -A "${CHAIN}" -s "${BACKEND_SUBNET}" -p tcp --dport "${PG_PORT}" -j ACCEPT -m comment --comment "pg-from-backend"
  iptables -A "${CHAIN}" -s "${BACKEND_SUBNET}" -p tcp --dport "${PGB_PORT}" -j ACCEPT -m comment --comment "pgb-from-backend"

  # Allow from infrastructure subnet (PgBouncer→primary, replication)
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${PG_PORT}" -j ACCEPT -m comment --comment "pg-from-infra"
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${PGB_PORT}" -j ACCEPT -m comment --comment "pgb-from-infra"

  # Allow loopback (local diagnostics, backup scripts)
  iptables -A "${CHAIN}" -s 127.0.0.1/8 -p tcp --dport "${PG_PORT}" -j ACCEPT -m comment --comment "pg-localhost"
  iptables -A "${CHAIN}" -s 127.0.0.1/8 -p tcp --dport "${PGB_PORT}" -j ACCEPT -m comment --comment "pgb-localhost"

  # Allow WAL archive traffic (postgres-replica streaming)
  iptables -A "${CHAIN}" -s "${INFRA_SUBNET}" -p tcp --dport "${PG_PORT}" -m state --state ESTABLISHED,RELATED -j ACCEPT -m comment --comment "pg-repl-established"

  # Drop everything else
  iptables -A "${CHAIN}" -p tcp --dport "${PG_PORT}" -j DROP -m comment --comment "pg-drop-other"
  iptables -A "${CHAIN}" -p tcp --dport "${PGB_PORT}" -j DROP -m comment --comment "pgb-drop-other"

  # Hook into INPUT chain (idempotent)
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -I INPUT -j "${CHAIN}"

  log_ok "PostgreSQL firewall rules installed."
  log_ok "  PostgreSQL (5432) allowed from: ${BACKEND_SUBNET}, ${INFRA_SUBNET}, 127.0.0.1/8"
  log_ok "  PgBouncer   (6432) allowed from: ${BACKEND_SUBNET}, ${INFRA_SUBNET}, 127.0.0.1/8"
}

# ── Teardown rules ──────────────────────────────────────────────────
teardown_rules() {
  iptables -D INPUT -j "${CHAIN}" 2> /dev/null || true
  iptables -F "${CHAIN}" 2> /dev/null || true
  iptables -X "${CHAIN}" 2> /dev/null || true
  log_ok "PostgreSQL firewall rules removed."
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
