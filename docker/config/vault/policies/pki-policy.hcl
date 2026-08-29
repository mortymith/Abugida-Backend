# ═════════════════════════════════════════════════════════════════════
# Vault Policy: PKI Certificate Issuance
# Source: ADR-006
#
# Allows services to request TLS certificates from the Vault PKI engine.
# Certificates are issued with short TTLs; Vault handles rotation.
# Scoped strictly to issuance roles — no engine management.
# ═════════════════════════════════════════════════════════════════════

# ── Issue server certificates for internal services ────────────────
path "pki/issue/internal-server" {
  capabilities = ["create", "update"]
}

# ── Issue client certificates for mTLS ─────────────────────────────
path "pki/issue/internal-client" {
  capabilities = ["create", "update"]
}

# ── Issue application-specific certificates ────────────────────────
path "pki/issue/app-internal" {
  capabilities = ["create", "update"]
}

# ── Read CA chain and CRL for verification ─────────────────────────
path "pki/cert/ca_chain" {
  capabilities = ["read"]
}

path "pki/crl" {
  capabilities = ["read"]
}

# ── List roles (service discovery) ─────────────────────────────────
path "pki/roles/*" {
  capabilities = ["list", "read"]
}
