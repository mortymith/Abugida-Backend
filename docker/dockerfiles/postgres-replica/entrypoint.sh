#!/usr/bin/env bash
# PostgreSQL Replica Entrypoint
# Source: deployment.md v3.0.0, ADR-002
#
# On first boot: pg_basebackup from primary, then start as standby.
# On restart: start normally (recovery.signal already exists in PGDATA).

set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PRIMARY_HOST="${POSTGRES_PRIMARY_HOST:-postgres-primary}"
SLOT_NAME="${SLOT_NAME:-replica_slot_1}"

# Read password from environment variable (ADR-006)
if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export PGPASSWORD="${POSTGRES_PASSWORD}"
fi

# ── Step 1: Check if this is a fresh boot (no PGDATA) ──────────────────
if [ ! -s "${PGDATA}/PG_VERSION" ]; then
  echo "==> [replica] Fresh boot detected. Running pg_basebackup from ${PRIMARY_HOST}..."

  # Wait for primary to be ready
  echo "==> [replica] Waiting for primary ${PRIMARY_HOST}:5432..."
  for i in $(seq 1 60); do
    if pg_isready -h "${PRIMARY_HOST}" -p 5432 -U replicator -q 2> /dev/null; then
      echo "==> [replica] Primary is ready after ${i}s."
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "==> [replica] ERROR: Primary not reachable after 60s. Aborting."
      exit 1
    fi
    sleep 2
  done

  # Run pg_basebackup
  # -D: target data directory
  # -h/-p/-U: connect to primary as replicator
  # -S: use a specific replication slot (prevents WAL buildup on primary)
  # -R: create standby.signal and postgresql.auto.conf with primary_conninfo
  # -Xs: stream WAL during backup for faster recovery
  # -P: show progress
  echo "==> [replica] Running pg_basebackup (slot: ${SLOT_NAME})..."
  pg_basebackup \
    -h "${PRIMARY_HOST}" \
    -p 5432 \
    -U replicator \
    -D "${PGDATA}" \
    -S "${SLOT_NAME}" \
    -R \
    -Xs \
    -P \
    --no-password

  # Append replica.conf overrides to postgresql.auto.conf
  # This includes hot_standby_feedback and replica-specific tuning
  echo "include = '/etc/postgresql/replica.conf'" >> "${PGDATA}/postgresql.auto.conf"

  # Ensure correct ownership
  chown -R postgres:postgres "${PGDATA}"
  chmod 700 "${PGDATA}"

  echo "==> [replica] pg_basebackup complete. Starting as standby."
fi

# ── Step 2: Delegate to standard PostgreSQL entrypoint ─────────────────
# The standard entrypoint handles:
#   - Setting permissions
#   - Initializing if PGDATA is empty (shouldn't happen here)
#   - Starting postgres with any existing recovery.signal

# Preserve the original docker-entrypoint.sh behavior
exec docker-entrypoint.sh "$@"
