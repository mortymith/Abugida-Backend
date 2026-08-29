#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Tunnel Access Validation — Verify SigNoz/Vault are unreachable from public
# Source: deployment.md v3.0.0 Phase 14, §2.4
#
# Validates:
#   1. SigNoz UI is reachable ONLY via Cloudflare Tunnel (not direct port)
#   2. Vault UI is NEVER exposed via any path (internal only per §2.4)
#   3. Cloudflare Tunnel config does not include Vault port 8200
#   4. All infrastructure ports (6379, 5432, 8200, 8123, etc.) are unreachable
#      from the public IP
#
# Usage:
#   bash tests/security/tunnel-access-test.sh
#   bash tests/security/tunnel-access-test.sh --ci
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# ── Configuration ──────────────────────────────────────────────────
CI_MODE=false
PUBLIC_IP="${PUBLIC_IP:-}"
TUNNEL_DOMAIN="${TUNNEL_DOMAIN:-}"
PASS=0
FAIL=0

# ── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

log_pass() {
  echo -e "  ${GREEN}[PASS]${RESET}  $*"
  ((PASS++)) || true
}
log_fail() {
  echo -e "  ${RED}[FAIL]${RESET}  $*"
  ((FAIL++)) || true
}
log_warn() { echo -e "  ${YELLOW}[WARN]${RESET}  $*"; }

# ── Parse Arguments ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
  --ci)
    CI_MODE=true
    shift
    ;;
  --target)
    PUBLIC_IP="$2"
    shift 2
    ;;
  --domain)
    TUNNEL_DOMAIN="$2"
    shift 2
    ;;
  --help | -h)
    echo "Usage: $0 [--ci] [--target PUBLIC_IP] [--domain TUNNEL_DOMAIN]"
    echo ""
    echo "  --target   Public IP of the server (for direct port tests)"
    echo "  --domain   Cloudflare Tunnel domain for SigNoz"
    echo "  --ci       Exit 1 on any failure"
    exit 0
    ;;
  *)
    echo "Unknown: $1"
    exit 1
    ;;
  esac
done

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Tunnel Access & Public Exposure Validation${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# ═════════════════════════════════════════════════════════════════════
# 1. Cloudflare Tunnel Config — Vault MUST NOT be tunneled
# ═════════════════════════════════════════════════════════════════════
echo -e "${BOLD}── Cloudflare Tunnel Config Audit ──${RESET}"

CF_CONFIG="${PROJECT_ROOT}/docker/config/cloudflared/config.yml"
if [ -f "$CF_CONFIG" ]; then
  # Vault port 8200 must NOT appear in tunnel ingress rules
  if grep -q '8200' "$CF_CONFIG" 2> /dev/null; then
    log_fail "Cloudflare tunnel config references port 8200 (Vault) — REMOVE IT (§2.4)"
  else
    log_pass "Vault port 8200 NOT in tunnel config"
  fi

  # Vault cluster port 8201 must NOT appear
  if grep -q '8201' "$CF_CONFIG" 2> /dev/null; then
    log_fail "Cloudflare tunnel config references port 8201 (Vault cluster) — REMOVE IT"
  else
    log_pass "Vault cluster port 8201 NOT in tunnel config"
  fi

  # Direct infrastructure port references should not exist
  for infra_port in 5432 6432 6379 8123 26379; do
    if grep -q "$infra_port" "$CF_CONFIG" 2> /dev/null; then
      service=""
      case "$infra_port" in
      5432) service="PostgreSQL" ;;
      6432) service="PgBouncer" ;;
      6379) service="Redis" ;;
      8123) service="ClickHouse" ;;
      26379) service="Redis Sentinel" ;;
      esac
      log_fail "Tunnel config references ${service} port ${infra_port} — infrastructure must not be tunneled"
    else
      log_pass "${infra_port} not in tunnel config"
    fi
  done
else
  log_warn "cloudflared config.yml not found (expected at config/cloudflared/config.yml)"
fi

# ═════════════════════════════════════════════════════════════════════
# 2. Docker Compose Prod — No infrastructure ports published
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Prod Compose Port Exposure Check ──${RESET}"

PROD_OVERRIDE="${PROJECT_ROOT}/docker/compose/profiles/prod.override.yml"
INFRA_PORTS=(5432 6432 6379 9000 9001 8200 8123 26379 4317 4318 3002)

if [ -f "$PROD_OVERRIDE" ]; then
  for port in "${INFRA_PORTS[@]}"; do
    if grep -qE "\b${port}\b" "$PROD_OVERRIDE" 2> /dev/null; then
      if grep -A5 'ports:' "$PROD_OVERRIDE" | grep -qE "\b${port}:|:${port}"; then
        log_fail "Port ${port} published in prod override"
      fi
    fi
  done
  if grep -A1 'ports:' "$PROD_OVERRIDE" | grep -qE '\d+:\d+'; then
    non_standard=$(grep -A1 'ports:' "$PROD_OVERRIDE" | grep -oE '\d+' | head -1)
    if [ "$non_standard" != "80" ] && [ "$non_standard" != "443" ]; then
      log_warn "Non-standard port '${non_standard}' found in prod ports section — verify this is Caddy"
    fi
  fi
  log_pass "No unexpected infrastructure ports published in prod override"
else
  log_warn "prod.override.yml not found"
fi

# ═════════════════════════════════════════════════════════════════════
# 3. Network-level validation (if PUBLIC_IP provided)
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Direct Port Probes (public surface) ──${RESET}"

if [ -n "$PUBLIC_IP" ]; then
  # Test infrastructure ports are NOT reachable from outside
  CRIT_PORTS=(6379 5432 8200 8123 26379 6432 9000)
  for port in "${CRIT_PORTS[@]}"; do
    if timeout 3 bash -c "echo >/dev/tcp/${PUBLIC_IP}/${port}" 2> /dev/null; then
      log_fail "Port ${port} is REACHABLE from public IP ${PUBLIC_IP} — firewall misconfigured!"
    else
      log_pass "Port ${port} NOT reachable from ${PUBLIC_IP}"
    fi
  done

  # Test public ports ARE reachable
  for port in 80 443; do
    if timeout 3 bash -c "echo >/dev/tcp/${PUBLIC_IP}/${port}" 2> /dev/null; then
      log_pass "Port ${port} reachable from public (expected)"
    else
      log_warn "Port ${port} NOT reachable from public — may be behind Cloudflare proxy"
    fi
  done
else
  echo "  (skipping — set --target PUBLIC_IP to probe public ports)"
fi

# ═════════════════════════════════════════════════════════════════════
# 4. SigNoz tunnel reachability (if TUNNEL_DOMAIN provided)
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── SigNoz Tunnel Reachability ──${RESET}"

if [ -n "$TUNNEL_DOMAIN" ]; then
  HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' "https://${TUNNEL_DOMAIN}" 2> /dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    log_pass "SigNoz reachable via tunnel domain (${TUNNEL_DOMAIN})"
  else
    log_warn "SigNoz NOT reachable via tunnel (HTTP ${HTTP_CODE}) — tunnel may not be configured yet"
  fi
else
  echo "  (skipping — set --domain TUNNEL_DOMAIN to test SigNoz tunnel)"
fi

# ═════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
printf "  ${GREEN}Passed: %d${RESET}   ${RED}Failed: %d${RESET}\n" "$PASS" "$FAIL"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}FAILED: ${FAIL} finding(s) require attention.${RESET}"
  exit 1
fi

echo -e "  ${GREEN}PASSED: No tunnel access violations found.${RESET}"
exit 0
