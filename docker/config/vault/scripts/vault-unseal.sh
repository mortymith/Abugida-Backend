#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Vault Unseal Helper (Production)
# Source: deployment.md v3.0.0, ADR-006
#
# Reads unseal keys from the local gitignored init-output file
# and applies the threshold (3 of 5) to unseal Vault.
#
# Usage:
#   ./vault-unseal.sh
#   VAULT_ADDR=https://vault:8200 ./vault-unseal.sh
#
# Prerequisites:
#   - vault-init.sh has been run
#   - data/vault/init-output.json exists (gitignored)
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"
export VAULT_ADDR
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-0}"

# 2.8 Fix: Use absolute path or env-var override
INIT_OUTPUT="${INIT_OUTPUT_FILE:-}"
if [ -z "${INIT_OUTPUT}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  INIT_OUTPUT="${SCRIPT_DIR}/../../../data/vault/init-output.json"
fi
KEY_THRESHOLD=3

# ── Check init output exists ──────────────────────────────────────
if [ ! -f "${INIT_OUTPUT}" ]; then
  echo "[vault-unseal][ERROR] Init output not found: ${INIT_OUTPUT}" >&2
  echo "[vault-unseal][ERROR] Run vault-init.sh first." >&2
  exit 1
fi

# ── Wait for the Vault API to accept connections ──────────────────
# The container may still be booting when this runs right after
# `compose up`; applying keys before the listener is up fails hard.
API_WAIT="${VAULT_API_WAIT:-60}"
elapsed=0
until vault status > /dev/null 2>&1; do
  code=$?
  # Exit codes 0 (unsealed) and 2 (sealed) both mean the server answered.
  if [ "$code" -eq 0 ] || [ "$code" -eq 2 ]; then
    break
  fi
  if [ "$elapsed" -ge "$API_WAIT" ]; then
    echo "[vault-unseal][ERROR] Vault API not reachable at ${VAULT_ADDR} within ${API_WAIT}s." >&2
    exit 1
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

# ── Check if already unsealed ─────────────────────────────────────
SEAL_STATUS=$(vault status 2>&1 || true)
if echo "${SEAL_STATUS}" | grep -q 'Sealed.*false'; then
  echo "[vault-unseal] Vault is already unsealed."
  exit 0
fi

if echo "${SEAL_STATUS}" | grep -q 'Sealed.*true'; then
  echo "[vault-unseal] Vault is sealed. Applying ${KEY_THRESHOLD} unseal keys..."
fi

# ── Apply unseal keys ─────────────────────────────────────────────
for i in 0 1 2; do
  KEY=$(jq -r ".unseal_keys_b64[${i}]" "${INIT_OUTPUT}")
  # 3.8 Fix: Do not echo unseal response — may contain key shard values
  vault operator unseal "${KEY}" > /dev/null 2>&1
  echo "[vault-unseal]  Applied key shard $((i + 1))"
done

# ── Verify ─────────────────────────────────────────────────────────
VERIFY=$(vault status 2>&1 || true)
if echo "${VERIFY}" | grep -q 'Sealed.*false'; then
  echo "[vault-unseal][OK] Vault is now unsealed."
else
  echo "[vault-unseal][ERROR] Vault is still sealed. Check key shards." >&2
  exit 1
fi
