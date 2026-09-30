#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Tiered Environment Bring-up (shared by dev / staging / prod)
# ADR-009, ADR-021
#
# Idempotent: safe to re-run on an already-running environment.
#
# Usage:
#   bash scripts/setup/bring-up.sh dev
#   bash scripts/setup/bring-up.sh staging
#   bash scripts/setup/bring-up.sh prod
#
# Steps per tier:
#   dev      .env scaffold → compose up → wait → db push → MinIO init
#   staging  Vault TLS  → compose up → wait → db push → MinIO → Vault
#   prod     Vault TLS  → compose up → wait → db push → MinIO → Redis
#            cluster → Vault
#
# Exit codes: 0 = ready, 1 = failure, 64 = bad usage.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/compose.sh
source "${SCRIPT_DIR}/../lib/compose.sh"

TIER="${1:-}"
require_tier "${TIER}"

ENV_FILE="${ENV_FILE:-.env}"
VAULT_TLS_SCRIPT="docker/config/vault/scripts/init-vault-tls.sh"

# ─── Helpers ────────────────────────────────────────────────────────
# Apply schema without codegen: db:push needs no interactive input, so
# bring-up stays safe to run unattended. Use `just db-generate` after
# changing packages/database/schema to author migrations.
push_schema() {
  require_cmd pnpm "install Node dependencies first (corepack enable && pnpm install)"
  log_info "Applying database schema (db:push)..."
  if [ -n "${DATABASE_URL:-}" ]; then
    pnpm --filter @abugida/database db:push
  else
    # staging/prod keep DATABASE_URL in .env; export it for the child process
    export DATABASE_URL="$(env_or_dotenv DATABASE_URL)"
    if [ -z "${DATABASE_URL}" ]; then
      die "DATABASE_URL is not set — add it to ${ENV_FILE} before bringing up ${TIER}"
    fi
    pnpm --filter @abugida/database db:push
  fi
}

# ─── 1. Preflight ───────────────────────────────────────────────────
ensure_env_file
log_info "Bringing up ${TIER} environment..."

if [ "${TIER}" != "dev" ]; then
  require_cmd jq "install jq (brew install jq / apt-get install jq)"
  log_info "Ensuring Vault TLS material exists..."
  bash "${VAULT_TLS_SCRIPT}"
fi

# ─── 2. Stack ───────────────────────────────────────────────────────
log_info "Starting ${TIER} services..."
dc "${TIER}" up -d

log_info "Waiting for core services to be healthy..."
bash docker/init/wait-for-services.sh "${TIER}"

# ─── 3. Data layer ──────────────────────────────────────────────────
push_schema

log_info "Initializing MinIO buckets (idempotent, best-effort)..."
dc "${TIER}" run --rm init-minio || log_warn "MinIO init failed — rerun: just minio-init"

if [ "${TIER}" = "prod" ]; then
  log_info "Initializing Redis cluster (best-effort)..."
  bash docker/init/init-redis.sh || log_warn "Redis init failed — rerun: bash docker/init/init-redis.sh"
fi

# ─── 4. Secrets (staging + prod) ────────────────────────────────────
if [ "${TIER}" != "dev" ]; then
  bash scripts/setup/vault-bootstrap.sh
fi

# ─── 5. Done ────────────────────────────────────────────────────────
log_ok "${TIER} environment ready. Next: just health"
