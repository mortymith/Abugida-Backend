#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Vault Initialization (Production — run ONCE)
# Source: deployment.md v3.0.0, ADR-006
#
# 1. Initializes Vault (5 key shards, threshold 3)
# 2. Captures unseal keys + root token to a LOCAL GITIGNORED file
#    — NEVER to logs, Telegram, or any remote channel
# 3. Unseals Vault with 3 key shards
# 4. Enables secret engines: kv-v2, database, pki
# 5. Enables AppRole auth method
# 6. Writes policies from config/vault/policies/
# 7. Creates AppRole roles for api + dashboard
#
# Output file: data/vault/init-output.json (gitignored)
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"
export VAULT_ADDR

# Skip TLS verification for first boot (self-signed or operator cert)
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-1}"

POLICIES_DIR="$(cd "$(dirname "$0")/../policies" && pwd)"
INIT_OUTPUT="${INIT_OUTPUT_FILE:-./data/vault/init-output.json}"
KEY_THRESHOLD=3
KEY_SHARES=5

# ── Helpers ────────────────────────────────────────────────────────
log_info() { echo "[vault-init] $*"; }
log_ok() { echo "[vault-init][OK] $*"; }
log_err() { echo "[vault-init][ERROR] $*" >&2; }

ensure_output_dir() {
  mkdir -p "$(dirname "${INIT_OUTPUT}")"
}

# ── 1. Check if already initialized ────────────────────────────────
INIT_STATUS=$(vault status 2>&1 || true)
if echo "${INIT_STATUS}" | grep -q 'Initialized.*true'; then
  log_info "Vault is already initialized. Skipping init."
  log_info "Unseal keys and root token are in: ${INIT_OUTPUT}"
  exit 0
fi

log_info "Initializing Vault (${KEY_SHARES} key shares, threshold ${KEY_THRESHOLD})..."

# ── 2. Initialize + capture output to LOCAL file ONLY ─────────────
ensure_output_dir

# vault operator init outputs JSON; redirect to file, never stdout to logs
vault operator init \
  -key-shares="${KEY_SHARES}" \
  -key-threshold="${KEY_THRESHOLD}" \
  -format=json \
  > "${INIT_OUTPUT}" 2> /dev/null

chmod 600 "${INIT_OUTPUT}"
log_ok "Initialization output saved to ${INIT_OUTPUT} (chmod 600, gitignored)"

# ── 3. Unseal with first 3 shards ─────────────────────────────────
log_info "Unsealing Vault..."
for i in 0 1 2; do
  KEY=$(jq -r ".unseal_keys_b64[${i}]" "${INIT_OUTPUT}")
  vault operator unseal "${KEY}" > /dev/null 2>&1
  log_info "  Applied unseal key shard $((i + 1)) of ${KEY_THRESHOLD}"
done
log_ok "Vault unsealed."

# ── 4. Authenticate with root token ───────────────────────────────
ROOT_TOKEN=$(jq -r '.root_token' "${INIT_OUTPUT}")
export VAULT_TOKEN="${ROOT_TOKEN}"

# ── 5. Enable secret engines ───────────────────────────────────────
# KV-v2 (version 2)
if vault secrets list 2> /dev/null | grep -q 'secret/'; then
  log_info "KV engine already enabled."
else
  vault secrets enable -path=secret kv-v2
  log_ok "Enabled kv-v2 engine at secret/."
fi

# Database (dynamic PostgreSQL credentials)
if vault secrets list 2> /dev/null | grep -q 'database/'; then
  log_info "Database engine already enabled."
else
  vault secrets enable database
  log_ok "Enabled database secrets engine."
fi

# PKI (internal TLS certificates)
if vault secrets list 2> /dev/null | grep -q 'pki/'; then
  log_info "PKI engine already enabled."
else
  vault secrets enable pki
  # Tune max lease TTL to 72h for internal certs
  vault secrets tune -max-lease-ttl=72h pki
  # Generate internal CA
  vault write -format=json pki/root/generate/internal \
    common_name="Internal CA" \
    ttl=87600h \
    > /dev/null 2>&1
  # Configure CA and CRL URLs
  vault write pki/config/urls \
    issuing_certificates="https://vault:8200/v1/pki/ca" \
    crl_distribution_points="https://vault:8200/v1/pki/crl"
  log_ok "Enabled PKI engine with internal CA (72h max lease, 10-year CA TTL)."
fi

# ── 6. Write policies ─────────────────────────────────────────────
for POLICY_FILE in "${POLICIES_DIR}"/*.hcl; do
  POLICY_NAME="$(basename "${POLICY_FILE}" .hcl)"
  vault policy write "${POLICY_NAME}" "${POLICY_FILE}"
  log_ok "Wrote policy: ${POLICY_NAME}"
done

# ── 7. Enable AppRole auth method ─────────────────────────────────
if vault auth list 2> /dev/null | grep -q 'approle/'; then
  log_info "AppRole auth method already enabled."
else
  vault auth enable approle
  log_ok "Enabled AppRole auth method."
fi

# ── 8. Create AppRole roles ────────────────────────────────────────
# API service role
vault write auth/approle/role/api \
  token_policies="app,pki" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=0 2> /dev/null &&
  log_ok "Created AppRole role: api" ||
  log_info "AppRole role 'api' already exists."

# Dashboard service role
vault write auth/approle/role/dashboard \
  token_policies="app,pki" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=0 2> /dev/null &&
  log_ok "Created AppRole role: dashboard" ||
  log_info "AppRole role 'dashboard' already exists."

# ── 9. Configure PKI roles ─────────────────────────────────────────
# Internal server role (for backend services)
vault write pki/roles/internal-server \
  allowed_domains="${COMPOSE_PROJECT_NAME:-infra}.local,*.${COMPOSE_PROJECT_NAME:-infra}.local" \
  allow_subdomains=true \
  max_ttl=72h 2> /dev/null &&
  log_ok "Created PKI role: internal-server" ||
  log_info "PKI role 'internal-server' already exists."

# Internal client role (for mTLS)
vault write pki/roles/internal-client \
  allowed_domains="${COMPOSE_PROJECT_NAME:-infra}.local,*.${COMPOSE_PROJECT_NAME:-infra}.local" \
  allow_subdomains=true \
  max_ttl=72h \
  client_flag=true 2> /dev/null &&
  log_ok "Created PKI role: internal-client" ||
  log_info "PKI role 'internal-client' already exists."

# App-internal role (for API/Dashboard cert issuance)
vault write pki/roles/app-internal \
  allowed_domains="*.${COMPOSE_PROJECT_NAME:-infra}.local" \
  allow_subdomains=true \
  max_ttl=72h 2> /dev/null &&
  log_ok "Created PKI role: app-internal" ||
  log_info "PKI role 'app-internal' already exists."

# ── 10. Generate AppRole secret IDs (save to output file) ──────────
API_ROLE_ID=$(vault read -format=json auth/approle/role/api/role-id | jq -r '.data.role_id')
API_SECRET_ID=$(vault write -format=json -f - auth/approle/role/api/secret-id 2> /dev/null | jq -r '.data.secret_id') || true

DASHBOARD_ROLE_ID=$(vault read -format=json auth/approle/role/dashboard/role-id | jq -r '.data.role_id')
DASHBOARD_SECRET_ID=$(vault write -format=json -f - auth/approle/role/dashboard/secret-id 2> /dev/null | jq -r '.data.secret_id') || true

# Append AppRole credentials to init output (same gitignored file)
tmp=$(mktemp)
jq \
  --arg api_role_id "${API_ROLE_ID}" \
  --arg api_secret_id "${API_SECRET_ID:-generated-at-runtime}" \
  --arg dashboard_role_id "${DASHBOARD_ROLE_ID}" \
  --arg dashboard_secret_id "${DASHBOARD_SECRET_ID:-generated-at-runtime}" \
  '. + {approle: {api: {role_id: $api_role_id, secret_id: $api_secret_id}, dashboard: {role_id: $dashboard_role_id, secret_id: $dashboard_secret_id}}}' \
  "${INIT_OUTPUT}" > "${tmp}" && mv "${tmp}" "${INIT_OUTPUT}"
chmod 600 "${INIT_OUTPUT}"

log_ok "AppRole credentials appended to ${INIT_OUTPUT}"

# ── Done ────────────────────────────────────────────────────────────
log_info "════════════════════════════════════════════════════"
log_info "Vault initialization COMPLETE."
log_info ""
log_info "  Init output:  ${INIT_OUTPUT}"
log_info "  Engines:      kv-v2 (secret/), database, pki"
log_info "  Auth methods: approle, token"
log_info "  Policies:     app, admin, pki"
log_info "  AppRoles:     api, dashboard"
log_info ""
log_info "  NEXT STEPS:"
log_info "    1. Run: vault-secrets.sh  (populate KV paths)"
log_info "    2. Configure database engine connection"
log_info "    3. NEVER commit ${INIT_OUTPUT} to VCS"
log_info "════════════════════════════════════════════════════"

# Unset token from environment (operator must manage token explicitly)
unset VAULT_TOKEN
