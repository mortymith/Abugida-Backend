#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Port Scan — Verify only expected ports are reachable
# Source: deployment.md v3.0.0 Phase 14, §12.1 Port Reference
#
# Scans the dev stack from "outside" the edge network to confirm
# only ports 80/443 (HTTP/HTTPS) are publicly accessible.
# Cross-checks against §12.1 Port Reference table.
#
# Usage:
#   bash tests/security/nmap/scan-ports.sh                       # scan localhost
#   bash tests/security/nmap/scan-ports.sh --target 192.168.1.10  # scan a host
#   bash tests/security/nmap/scan-ports.sh --ci                   # exit 1 on violations
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# ── Configuration ──────────────────────────────────────────────────
TARGET="${TARGET:-127.0.0.1}"
CI_MODE=false
SCAN_TOP_PORTS=1000

# ── Expected ports (§12.1 Port Reference) ─────────────────────────
# In production, ONLY 80 and 443 should be open from outside.
# In development, additional ports are exposed for debugging.
ENVIRONMENT="${ENVIRONMENT:-development}"

# ── Parse Arguments ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
  --target)
    TARGET="$2"
    shift 2
    ;;
  --ci)
    CI_MODE=true
    shift
    ;;
  --env)
    ENVIRONMENT="$2"
    shift 2
    ;;
  --help | -h)
    echo "Usage: $0 [--target HOST] [--ci] [--env ENV]"
    echo ""
    echo "  --target HOST  Target host to scan (default: 127.0.0.1)"
    echo "  --ci          CI mode: exit 1 on unexpected open ports"
    echo "  --env ENV     Environment: development|production"
    exit 0
    ;;
  *)
    echo "Unknown option: $1"
    exit 1
    ;;
  esac
done

# ── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Port Reference (§12.1) ─────────────────────────────────────────
# Format: PORT:SERVICE:EXPECTED_IN_PROD:EXPECTED_IN_DEV
PORT_REF=(
  "80:Caddy HTTP:yes:yes"
  "443:Caddy HTTPS:yes:yes"
  "3001:API:internal:yes"
  "8081:Dashboard:internal:yes"
  "8082:Marketing:internal:yes"
  "6379:Redis:internal:yes"
  "5432:PostgreSQL:internal:yes"
  "6432:PgBouncer:internal:yes"
  "9000:MinIO API:internal:yes"
  "9001:MinIO Console:internal:yes"
  "8200:Vault:internal:yes"
  "3002:SigNoz:internal:yes"
  "4317:OTEL gRPC:internal:yes"
  "4318:OTEL HTTP:internal:yes"
  "8123:ClickHouse HTTP:internal:yes"
  "26379:Redis Sentinel:internal:yes"
)

# Build expected port sets
EXPECTED_PROD="80,443"
EXPECTED_DEV="80,443,3001,8081,6379,5432,6432,9000,9001,8200,3002,4317,4318,8123,26379"

if [ "$ENVIRONMENT" = "production" ]; then
  EXPECTED_PORTS="$EXPECTED_PROD"
  EXPECTED_SET="80 443"
else
  EXPECTED_PORTS="$EXPECTED_DEV"
  EXPECTED_SET="80 443 3001 8081 6379 5432 6432 9000 9001 8200 3002 4317 4318 8123 26379"
fi

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Port Scan — Security Validation${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo "  Target:       ${TARGET}"
echo "  Environment:  ${ENVIRONMENT}"
echo "  Expected:     ${EXPECTED_PORTS}"
echo ""

# ── Check nmap available ───────────────────────────────────────────
if ! command -v nmap > /dev/null 2>&1; then
  echo -e "${RED}nmap not found. Install with: sudo apt install nmap${RESET}"
  exit 1
fi

# ── Run scan ───────────────────────────────────────────────────────
echo "Scanning top ${SCAN_TOP_PORTS} ports on ${TARGET}..."
echo ""

# Parse nmap output for open TCP ports
OPEN_PORTS=$(nmap -sT -Pn --top-ports ${SCAN_TOP_PORTS} --open \
  -T4 "${TARGET}" 2> /dev/null |
  grep -oP '\d+/tcp\s+open' | grep -oP '^\d+' | sort -n | tr '\n' ' ')

if [ -z "$OPEN_PORTS" ]; then
  OPEN_PORTS="(none)"
fi

echo "Open ports found: ${OPEN_PORTS}"
echo ""

# ── Validate ───────────────────────────────────────────────────────
VIOLATIONS=0
UNEXPECTED=""

for port in $OPEN_PORTS; do
  if [ "$port" = "(none)" ]; then continue; fi
  found=false
  for expected in $EXPECTED_SET; do
    if [ "$port" = "$expected" ]; then
      found=true
      break
    fi
  done
  if [ "$found" = false ]; then
    # Look up the service name from PORT_REF
    service="unknown"
    for entry in "${PORT_REF[@]}"; do
      p=$(echo "$entry" | cut -d: -f1)
      s=$(echo "$entry" | cut -d: -f2)
      if [ "$p" = "$port" ]; then
        service="$s"
        break
      fi
    done
    echo -e "  ${RED}[VIOLATION]${RESET} Port ${port} (${service}) is OPEN but should NOT be accessible from outside"
    UNEXPECTED="${UNEXPECTED} ${port}"
    ((VIOLATIONS++)) || true
  else
    echo -e "  ${GREEN}[OK]${RESET}        Port ${port} (expected)"
  fi
done

echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "  ${RED}FAILED: ${VIOLATIONS} unexpected port(s) open:${UNEXPECTED}${RESET}"
  echo -e "  ${RED}In ${ENVIRONMENT}, only these ports should be accessible: ${EXPECTED_PORTS}${RESET}"
  exit 1
else
  echo -e "  ${GREEN}PASSED: All open ports match expected list for ${ENVIRONMENT}.${RESET}"
  exit 0
fi
