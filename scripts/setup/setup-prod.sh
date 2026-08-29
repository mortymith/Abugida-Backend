#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Prod Environment Setup (standalone, idempotent)
# Source: deployment.md v3.0.0, ADR-009
#
# Runs the full prod bootstrap: scaffold, compose up, init,
# Redis cluster, Vault init/unseal/secrets.
#
# Usage:
#   bash scripts/setup/setup-prod.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

VAULT_INIT_OUTPUT="./data/vault/init-output.json"

PROD_COMPOSE="docker compose --project-directory . -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/edge.yml -f docker/compose/scaling.yml -f docker/compose/security.yml -f docker/compose/profiles/prod.override.yml"

echo "==> [setup-prod] Starting prod services..."
${PROD_COMPOSE} up -d

echo "==> [setup-prod] Waiting for services..."
bash docker/init/wait-for-services.sh prod

echo "==> [setup-prod] Initializing MinIO..."
${PROD_COMPOSE} run --rm init-minio || true

echo "==> [setup-prod] Initializing Redis cluster..."
bash docker/init/init-redis.sh || true

echo "==> [setup-prod] Initializing Vault..."
if [ -f "${VAULT_INIT_OUTPUT}" ]; then
  echo "Vault already initialized. Unsealing..."
  INIT_OUTPUT_FILE="${VAULT_INIT_OUTPUT}" \
    VAULT_ADDR="https://127.0.0.1:8200" \
    VAULT_SKIP_VERIFY="1" \
    bash docker/config/vault/scripts/vault-unseal.sh
else
  INIT_OUTPUT_FILE="${VAULT_INIT_OUTPUT}" \
    VAULT_ADDR="https://127.0.0.1:8200" \
    VAULT_SKIP_VERIFY="1" \
    bash docker/config/vault/scripts/vault-init.sh

  INIT_OUTPUT_FILE="${VAULT_INIT_OUTPUT}" \
    VAULT_ADDR="https://127.0.0.1:8200" \
    VAULT_SKIP_VERIFY="1" \
    bash docker/config/vault/scripts/vault-unseal.sh

  export VAULT_TOKEN
  VAULT_TOKEN=$(jq -r .root_token "${VAULT_INIT_OUTPUT}")
  VAULT_ADDR="https://127.0.0.1:8200" \
    VAULT_SKIP_VERIFY="1" \
    bash docker/config/vault/scripts/vault-secrets.sh
  unset VAULT_TOKEN
fi

echo "==> [setup-prod] Prod environment ready."
