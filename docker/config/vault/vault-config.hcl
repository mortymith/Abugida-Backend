# ═════════════════════════════════════════════════════════════════════
# Vault Server Configuration (Production)
# Source: deployment.md v3.0.0, ADR-006
#
# Single-node file backend (Consul-free for this scope).
# TLS listener configured for intra-cluster mTLS.
# In production, Vault runs on the infrastructure network (internal only).
# ═════════════════════════════════════════════════════════════════════

# ── Storage ─────────────────────────────────────────────────────────
storage "file" {
  path = "/vault/file"
}

# ── Listener (TLS) ───────────────────────────────────────────────────
# Server cert/key + CA are provisioned by init-vault-tls.sh into
# data/vault/tls/ (bind-mounted to /vault/tls/).
listener "tcp" {
  address       = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_cert_file = "/vault/tls/server.crt"
  tls_key_file  = "/vault/tls/server.key"
  tls_client_ca_file = "/vault/tls/ca.crt"
  tls_disable   = 0
  # Client-cert verification cannot be required at boot: Vault's own PKI
  # issues client certs only after unseal (vault-init.sh). Healthchecks
  # and operator CLIs connect without one until then.
  tls_require_and_verify_client_cert = "false"
  # 4.16 Fix: Enforce minimum TLS version
  tls_min_version = "tls12"
}

# ── API ──────────────────────────────────────────────────────────────
api_addr = "https://vault:8200"
cluster_addr = "https://vault:8201"

# ── UI ───────────────────────────────────────────────────────────────
ui = true

# ── Disable mlock (containers often lack IPC_LOCK) ────────────────────
# disable_mlock must be false when IPC_LOCK cap is granted
# (the Docker compose grants cap_add: IPC_LOCK)
disable_mlock = false

# ── 3.16 Fix: Telemetry enabled ─────────────────────────────────────
# NOTE: statsite_address was removed — the signoz-otel-collector distro
# (v0.144.x) does not start its bundled statsd receiver, so :8125 never
# listened and Vault logged connection-refused every 5s. Metrics remain
# available at /v1/sys/metrics (Prometheus format) for future scraping.
telemetry {
  disable_hostname = true
  prometheus_retention_time = "24h"
  usage_gauge_period = "10m"
  maximum_gauge_cardinality = 500
}
