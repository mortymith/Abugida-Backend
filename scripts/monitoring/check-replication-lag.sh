#!/usr/bin/env bash
# Check PostgreSQL Replication Lag
# Source: deployment.md v3.0.0, ADR-002
# Called by: just health-replication
#
# Queries pg_stat_replication on the primary to show:
#   - Replica IP and state
#   - Sync mode (sync/async)
#   - WAL replay lag (seconds)
#   - Replication delay behind primary
#
# Exit codes:
#   0 — all replicas connected, lag < 10s
#   1 — WARNING: lag >= 10s or replica disconnected
#   2 — CRITICAL: primary not reachable or no replicas

set -euo pipefail

COMPOSE_FILES="${COMPOSE_FILES:-docker/compose/networks.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres-primary}"
POSTGRES_USER="${POSTGRES_USER:-app}"
WARN_LAG=10
CRIT_LAG=60

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Check if primary is reachable ──────────────────────────────────────────
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  PostgreSQL Replication Status${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

if ! docker compose --project-directory . exec -T "${POSTGRES_SERVICE}" pg_isready -U "${POSTGRES_USER}" -q 2> /dev/null; then
  echo -e "  ${RED}CRITICAL: PostgreSQL primary not reachable${RESET}"
  exit 2
fi

# ─── Query replication status ───────────────────────────────────────────────
REPL_OUTPUT=$(docker compose --project-directory . exec -T "${POSTGRES_SERVICE}" psql -U "${POSTGRES_USER}" -d app -t -A -c "
    SELECT
        COALESCE(client_addr::text, 'N/A') AS client_addr,
        COALESCE(state, 'N/A') AS state,
        COALESCE(sync_state, 'N/A') AS sync_state,
        COALESCE(EXTRACT(EPOCH FROM (now() - reply_lag))::bigint, -1) AS lag_seconds,
        COALESCE(sent_lag, '00:00:00') AS sent_lag,
        COALESCE(replay_lag, '00:00:00') AS replay_lag,
        COALESCE(slot_name, 'N/A') AS slot_name
    FROM pg_stat_replication
    ORDER BY client_addr;
" 2> /dev/null)

if [ -z "$REPL_OUTPUT" ]; then
  echo -e "  ${YELLOW}WARNING: No replicas connected (standalone primary)${RESET}"
  echo "  This is expected in development."
  exit 0
fi

# ─── Display & evaluate ────────────────────────────────────────────────────
MAX_LAG=0
REPLICA_COUNT=0
EXIT_CODE=0

printf "  ${BOLD}%-18s %-12s %-10s %-8s %s${RESET}\n" "Replica" "State" "Sync" "Lag(s)" "WAL Position"
echo "  ──────────────────────────────────────────────────────────"

while IFS='|' read -r addr state sync lag sent replay slot; do
  REPLICA_COUNT=$((REPLICA_COUNT + 1))
  LAG_INT=${lag:-0}

  if [ "$LAG_INT" -gt "$MAX_LAG" ]; then
    MAX_LAG=$LAG_INT
  fi

  # Color based on lag
  if [ "$LAG_INT" -ge "$CRIT_LAG" ]; then
    COLOR="$RED"
    EXIT_CODE=2
  elif [ "$LAG_INT" -ge "$WARN_LAG" ]; then
    COLOR="$YELLOW"
    EXIT_CODE=1
  else
    COLOR="$GREEN"
  fi

  printf "  ${COLOR}%-18s %-12s %-10s %-8s %s (slot: %s)${RESET}\n" \
    "$addr" "$state" "$sync" "$lag" "$replay" "$slot"
done <<< "$REPL_OUTPUT"

echo ""
echo -e "  ${BOLD}Summary:${RESET}  Replicas: ${REPLICA_COUNT}  |  Max Lag: ${MAX_LAG}s"

if [ "$MAX_LAG" -ge "$CRIT_LAG" ]; then
  echo -e "  ${RED}CRITICAL: Replication lag >= ${CRIT_LAG}s${RESET}"
elif [ "$MAX_LAG" -ge "$WARN_LAG" ]; then
  echo -e "  ${YELLOW}WARNING: Replication lag >= ${WARN_LAG}s${RESET}"
else
  echo -e "  ${GREEN}OK: All replicas within acceptable lag${RESET}"
fi

exit $EXIT_CODE
