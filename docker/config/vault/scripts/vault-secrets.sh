#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Vault Secret Population (Staging / Production)
# Source: deployment.md v3.0.0, ADR-006
#
# Writes all application/infrastructure secrets into Vault kv-v2.
# Values are read from environment variables, falling back to the
# project .env file (dev bootstrap values). This script NEVER reads
# from .env.prod or any other untracked secret store.
#
# Idempotent: kv put overwrites existing keys.
#
# Prerequisites:
#   - vault-init.sh has been run
#   - Vault is unsealed
#   - VAULT_TOKEN is set (or --token flag)
#
# Usage:
#   VAULT_TOKEN=s.xxx ./vault-secrets.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"
export VAULT_ADDR
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-1}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# ── Verify authentication ────────────────────────────────────────
if [ -z "${VAULT_TOKEN:-}" ]; then
  echo "[vault-secrets][ERROR] VAULT_TOKEN is not set." >&2
  echo "  Source it from the init output or operator token." >&2
  exit 1
fi

# ── Helpers ────────────────────────────────────────────────────────
log_ok() { echo "[vault-secrets][OK] $*"; }
log_skip() { echo "[vault-secrets][SKIP] $*"; }

# Resolve a secret value: exported env var first, then .env fallback.
resolve_secret() {
  local key="$1" current
  current="${!key:-}"
  if [ -n "${current}" ]; then
    printf '%s' "${current}"
  elif [ -f "${PROJECT_ROOT}/.env" ]; then
    printf '%s' "$(grep -E "^${key}=" "${PROJECT_ROOT}/.env" 2> /dev/null | head -1 | cut -d'=' -f2- | tr -d '"')"
  else
    printf ''
  fi
}

# ═══════════════════════════════════════════════════════════════════
# 1. Infrastructure secrets (KV-v2: secret/infra/...)
# ═══════════════════════════════════════════════════════════════════

# ── PostgreSQL ─────────────────────────────────────────────────────
PG_PASS=$(resolve_secret POSTGRES_PASSWORD)
if [ -n "${PG_PASS}" ]; then
  vault kv put secret/infra/postgres/password password="${PG_PASS}"
  log_ok "secret/infra/postgres/password"
else
  log_skip "secret/infra/postgres/password (POSTGRES_PASSWORD not set)"
fi

# ── Redis ───────────────────────────────────────────────────────────
REDIS_PASS=$(resolve_secret REDIS_PASSWORD)
if [ -n "${REDIS_PASS}" ]; then
  vault kv put secret/infra/redis/password password="${REDIS_PASS}"
  log_ok "secret/infra/redis/password"
else
  log_skip "secret/infra/redis/password (REDIS_PASSWORD not set)"
fi

REDIS_SENTINEL_PASS=$(resolve_secret REDIS_SENTINEL_PASSWORD)
if [ -n "${REDIS_SENTINEL_PASS}" ]; then
  vault kv put secret/infra/redis/sentinel-password password="${REDIS_SENTINEL_PASS}"
  log_ok "secret/infra/redis/sentinel-password"
else
  log_skip "secret/infra/redis/sentinel-password (REDIS_SENTINEL_PASSWORD not set)"
fi

REDIS_ADMIN_PASS=$(resolve_secret REDIS_ADMIN_PASSWORD)
if [ -n "${REDIS_ADMIN_PASS}" ]; then
  vault kv put secret/infra/redis/admin-password password="${REDIS_ADMIN_PASS}"
  log_ok "secret/infra/redis/admin-password"
else
  log_skip "secret/infra/redis/admin-password (REDIS_ADMIN_PASSWORD not set)"
fi

REDIS_READONLY_PASS=$(resolve_secret REDIS_READONLY_PASSWORD)
if [ -n "${REDIS_READONLY_PASS}" ]; then
  vault kv put secret/infra/redis/readonly-password password="${REDIS_READONLY_PASS}"
  log_ok "secret/infra/redis/readonly-password"
else
  log_skip "secret/infra/redis/readonly-password (REDIS_READONLY_PASSWORD not set)"
fi

# ── MinIO ───────────────────────────────────────────────────────────
MINIO_PASS=$(resolve_secret MINIO_ROOT_PASSWORD)
if [ -n "${MINIO_PASS}" ]; then
  vault kv put secret/infra/minio/root-password password="${MINIO_PASS}"
  log_ok "secret/infra/minio/root-password"
else
  log_skip "secret/infra/minio/root-password (MINIO_ROOT_PASSWORD not set)"
fi

# ── ClickHouse (observability storage; ADR-010) ─────────────────────
CH_PASS=$(resolve_secret CLICKHOUSE_PASSWORD)
if [ -n "${CH_PASS}" ]; then
  vault kv put secret/infra/clickhouse/password password="${CH_PASS}"
  log_ok "secret/infra/clickhouse/password"
else
  log_skip "secret/infra/clickhouse/password (CLICKHOUSE_PASSWORD not set)"
fi

# ── SigNoz metadata store + UI secret (ADR-003) ─────────────────────
SIGNOZ_DB_PASS=$(resolve_secret SIGNOZ_DB_PASSWORD)
if [ -n "${SIGNOZ_DB_PASS}" ]; then
  vault kv put secret/infra/signoz/db-password password="${SIGNOZ_DB_PASS}"
  log_ok "secret/infra/signoz/db-password"
else
  log_skip "secret/infra/signoz/db-password (SIGNOZ_DB_PASSWORD not set)"
fi

SIGNOZ_JWT=$(resolve_secret SIGNOZ_JWT_SECRET)
if [ -n "${SIGNOZ_JWT}" ]; then
  vault kv put secret/infra/signoz/jwt-secret secret="${SIGNOZ_JWT}"
  log_ok "secret/infra/signoz/jwt-secret"
else
  log_skip "secret/infra/signoz/jwt-secret (SIGNOZ_JWT_SECRET not set)"
fi

# ═══════════════════════════════════════════════════════════════════
# 2. Application secrets (KV-v2: secret/app/...)
# ═══════════════════════════════════════════════════════════════════

API_SECRET=$(resolve_secret API_SECRET_KEY)
if [ -n "${API_SECRET}" ]; then
  vault kv put secret/app/api/secret-key key="${API_SECRET}"
  log_ok "secret/app/api/secret-key"
else
  log_skip "secret/app/api/secret-key (API_SECRET_KEY not set)"
fi

# ── API database URL (computed from postgres password) ─────────────
if [ -n "${PG_PASS}" ]; then
  PGHOST="${PGHOST:-postgres-primary}"
  PGPORT="${PGPORT:-5432}"
  PGDATABASE="${PGDATABASE:-app}"
  PGUSER="${PGUSER:-app}"
  PG_URI="postgresql://${PGUSER}:${PG_PASS}@${PGHOST}:${PGPORT}/${PGDATABASE}"
  vault kv put secret/app/api/database-url url="${PG_URI}"
  log_ok "secret/app/api/database-url"
fi

# ── API Redis config ───────────────────────────────────────────────
if [ -n "${REDIS_PASS}" ]; then
  vault kv put secret/app/api/redis \
    password="${REDIS_PASS}" \
    host="redis-primary" \
    port="6379"
  log_ok "secret/app/api/redis"
fi

# ═══════════════════════════════════════════════════════════════════
# 3. Database secrets engine configuration
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "[vault-secrets] Configuring database secrets engine..."

# Configure PostgreSQL connection (used by dynamic credential roles)
# The plugin connects to PgBouncer for credential generation.
if [ -n "${PG_PASS}" ]; then
  vault write database/config/app \
    plugin_name=postgresql-database-plugin \
    allowed_roles="app-readonly,app-readwrite" \
    connection_url="postgresql://{{username}}:{{password}}@pgbouncer:6432/app?sslmode=require" \
    username="app" \
    password="${PG_PASS}" 2> /dev/null &&
    log_ok "database/config/app (PostgreSQL connection)" ||
    log_skip "database/config/app (may already exist)"

  # Readonly role: 1h TTL, max 24h
  vault write database/roles/app-readonly \
    db_name=app \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h" 2> /dev/null &&
    log_ok "database/roles/app-readonly" ||
    log_skip "database/roles/app-readonly"

  # Readwrite role: 1h TTL, max 4h
  vault write database/roles/app-readwrite \
    db_name=app \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="4h" 2> /dev/null &&
    log_ok "database/roles/app-readwrite" ||
    log_skip "database/roles/app-readwrite"
fi

# ═══════════════════════════════════════════════════════════════════
# 4. Verification — spot-check app policy scoping
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "[vault-secrets] ── Policy scoping verification ──"

# Create a temporary token with app-policy
APP_TOKEN=$(vault token create -policy=app -format=json | jq -r '.auth.client_token')
export VAULT_TOKEN="${APP_TOKEN}"

# Should SUCCEED: read own path
if vault kv get -format=json secret/app/api/secret-key > /dev/null 2>&1; then
  log_ok "app-policy CAN read secret/app/api/secret-key (expected)"
else
  echo "[vault-secrets][WARN] app-policy cannot read secret/app/api/secret-key"
fi

# Should FAIL: read infra path
if vault kv get secret/infra/postgres/password 2>&1 | grep -qi 'permission denied\|forbidden'; then
  log_ok "app-policy DENIED access to secret/infra/postgres/password (expected)"
else
  echo "[vault-secrets][WARN] app-policy could read secret/infra/postgres/password (policy leak!)"
fi

# Should FAIL: write to any path
if vault kv put secret/app/api/test key=value 2>&1 | grep -qi 'permission denied\|forbidden'; then
  log_ok "app-policy DENIED write to secret/app/api/* (expected)"
else
  echo "[vault-secrets][WARN] app-policy could write (policy leak!)"
  # Clean up test key if it was written
  vault kv metadata delete secret/app/api/test 2> /dev/null || true
fi

# Revoke temp token
echo "[vault-secrets] Revoking temporary app-policy token."
# We need root token for this — read from init output
if [ -f "${INIT_OUTPUT_FILE:-./data/vault/init-output.json}" ]; then
  ROOT_TOKEN=$(jq -r '.root_token' "${INIT_OUTPUT_FILE:-./data/vault/init-output.json}")
  VAULT_TOKEN="${ROOT_TOKEN}" vault token revoke "${APP_TOKEN}" 2> /dev/null || true
fi

echo ""
echo "[vault-secrets] ═════════════════════════════════════════"
echo "[vault-secrets] Secret population complete."
echo "[vault-secrets] ═════════════════════════════════════════"
