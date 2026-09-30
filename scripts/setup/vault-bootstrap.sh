#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Idempotent Vault Bootstrap (staging + production)
# ADR-006
#
# Decides between "unseal" and "re-initialize" by inspecting the ACTUAL
# Vault state, not the presence of init-output.json: that file lives on
# the host, so `just <tier>-clean` (which removes the Vault storage
# volume) leaves it stale.
#
# Usage:
#   bash scripts/setup/vault-bootstrap.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"
cd "${PROJECT_ROOT}"

VAULT_SCRIPTS="docker/config/vault/scripts"

VAULT_ADDR_VAL="$(env_or_dotenv VAULT_ADDR "https://127.0.0.1:8200")"
VAULT_SKIP_VERIFY_VAL="$(env_or_dotenv VAULT_SKIP_VERIFY "0")"
INIT_OUTPUT_FILE="$(env_or_dotenv VAULT_INIT_OUTPUT "${PROJECT_ROOT}/data/vault/init-output.json")"

export VAULT_ADDR="${VAULT_ADDR_VAL}"
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY_VAL}"

run_vault_init() {
  log_info "Initializing Vault..."
  INIT_OUTPUT_FILE="${INIT_OUTPUT_FILE}" bash "${VAULT_SCRIPTS}/vault-init.sh"
}

run_vault_unseal() {
  log_info "Unsealing Vault..."
  INIT_OUTPUT_FILE="${INIT_OUTPUT_FILE}" bash "${VAULT_SCRIPTS}/vault-unseal.sh"
}

run_vault_secrets() {
  if [ -z "${VAULT_TOKEN:-}" ]; then
    export VAULT_TOKEN="$(jq -r '.root_token' "${INIT_OUTPUT_FILE}")"
  fi
  log_info "Populating Vault with secrets..."
  bash "${VAULT_SCRIPTS}/vault-secrets.sh"
  unset VAULT_TOKEN
}

require_cmd jq "install jq (brew install jq / apt-get install jq)"
require_cmd vault "install the Vault CLI (https://developer.hashicorp.com/vault/downloads)"

# Never mistake "Vault not running" for "Vault not initialized": the second
# one justifies discarding the host copy of the unseal keys, the first just
# means the stack is not up yet. Query explicitly and fail loudly.
STATUS_JSON="$(vault status -format=json 2> /dev/null || true)"
if [ -z "${STATUS_JSON}" ] || ! printf '%s' "${STATUS_JSON}" | jq -e . > /dev/null 2>&1; then
  log_err "Vault is not reachable at ${VAULT_ADDR} — refusing to touch ${INIT_OUTPUT_FILE}"
  log_err "start the stack first, then re-run: just staging-up (or just prod-up)"
  exit 1
fi

INITIALIZED="$(printf '%s' "${STATUS_JSON}" | jq -r '.initialized // false')"

if [ ! -f "${INIT_OUTPUT_FILE}" ]; then
  log_info "No Vault init output found — initializing..."
  run_vault_init
  run_vault_unseal
  run_vault_secrets
  log_ok "Vault initialized at ${INIT_OUTPUT_FILE}"
  exit 0
fi

if [ "${INITIALIZED}" = "true" ]; then
  log_info "Vault already initialized (storage intact) — unsealing only."
  run_vault_unseal
else
  log_info "Vault init output is stale (storage wiped by <tier>-clean) — re-initializing..."
  log_warn "moving the stale file aside: ${INIT_OUTPUT_FILE}.stale"
  mv "${INIT_OUTPUT_FILE}" "${INIT_OUTPUT_FILE}.stale"
  run_vault_init
  run_vault_unseal
  run_vault_secrets
  log_ok "Vault re-initialized at ${INIT_OUTPUT_FILE}"
fi
