# ═════════════════════════════════════════════════════════════════════
# Vault Policy: Administrator (full management)
# Source: ADR-006
#
# Assigned to human operators via userpass or OIDC.
# NEVER assigned to application AppRoles.
# ═════════════════════════════════════════════════════════════════════

# ── KV-v2: All secrets ─────────────────────────────────────────────
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# ── Database engine ────────────────────────────────────────────────
path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# ── PKI engine ──────────────────────────────────────────────────────
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# ── AppRole auth method ────────────────────────────────────────────
path "auth/approle/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# ── System: audit, namespaces, policies ─────────────────────────────
path "sys/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
