# ═════════════════════════════════════════════════════════════════════
# Vault Policy: Application Service Access (read-only)
# Source: ADR-006
#
# Assigned to AppRole roles for API, Dashboard, and Marketing services.
# Scoped strictly to secret/data/app/* and database/creds/*.
# Denies all other paths by default (Vault default-deny).
# ═════════════════════════════════════════════════════════════════════

# ── KV-v2: Application secrets ─────────────────────────────────────
path "secret/data/app/api/*" {
  capabilities = ["read"]
}

path "secret/data/app/dashboard/*" {
  capabilities = ["read"]
}

# KV metadata (list keys under app/)
path "secret/metadata/app/*" {
  capabilities = ["list", "read"]
}

# ── Database: Dynamic credentials ───────────────────────────────────
path "database/creds/app-readonly" {
  capabilities = ["read"]
}

path "database/creds/app-readwrite" {
  capabilities = ["read"]
}

# ── PKI: Request internal certificates ──────────────────────────────
path "pki/issue/app-internal" {
  capabilities = ["create", "update"]
}

path "pki/cert/ca_chain" {
  capabilities = ["read"]
}
