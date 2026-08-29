#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Vault TLS Bootstrap (Staging / Production)
#
# Generates the self-signed CA + server certificate that
# docker/config/vault/vault-config.hcl requires at /vault/tls/.
# Nothing else provisions these (the referenced "init-vault-tls"
# bootstrap did not exist), so first boot fails without this step.
#
# Client-certificate issuance stays with Vault's own PKI: vault-init.sh
# creates the pki_int / internal-client roles AFTER unseal, which is why
# tls_require_and_verify_client_cert must stay false at boot.
#
# Idempotent: skips generation when a cert set already exists. Delete
# data/vault/tls/ to force regeneration (requires Vault recreate).
#
# Usage:
#   bash docker/config/vault/scripts/init-vault-tls.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
TLS_DIR="${PROJECT_ROOT}/data/vault/tls"

log_ok() { echo "[vault-tls][OK] $*"; }

mkdir -p "${TLS_DIR}"

if [ -f "${TLS_DIR}/ca.crt" ] && [ -f "${TLS_DIR}/server.crt" ] && [ -f "${TLS_DIR}/server.key" ]; then
  log_ok "TLS material already present in ${TLS_DIR} (skipping)"
  exit 0
fi

echo "[vault-tls] Generating self-signed CA..."
openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout "${TLS_DIR}/ca.key" \
  -out "${TLS_DIR}/ca.crt" \
  -subj "/CN=Abugida Vault Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

echo "[vault-tls] Generating server certificate (SANs: vault, localhost, 127.0.0.1)..."
openssl req -newkey rsa:2048 -sha256 -nodes \
  -keyout "${TLS_DIR}/server.key" \
  -out "${TLS_DIR}/server.csr" \
  -subj "/CN=vault"

openssl x509 -req -sha256 -days 825 \
  -in "${TLS_DIR}/server.csr" \
  -CA "${TLS_DIR}/ca.crt" \
  -CAkey "${TLS_DIR}/ca.key" \
  -CAcreateserial \
  -out "${TLS_DIR}/server.crt" \
  -extfile <(printf '%s\n' \
    'basicConstraints=critical,CA:FALSE' \
    'keyUsage=critical,digitalSignature,keyEncipherment' \
    'extendedKeyUsage=serverAuth' \
    'subjectAltName=DNS:vault,DNS:localhost,IP:127.0.0.1')

chmod 600 "${TLS_DIR}/ca.key" "${TLS_DIR}/server.key"
chmod 644 "${TLS_DIR}/ca.crt" "${TLS_DIR}/server.crt"
rm -f "${TLS_DIR}/server.csr" "${TLS_DIR}/ca.srl"

# The vault container entrypoint drops to uid/gid 100 (user "vault");
# without read access to server.key the listener fails to start.
# Strategy, in order of preference:
#   1. chown to 100:100        (clean; requires root or prior ownership)
#   2. POSIX ACL for uid 100   (works unprivileged on acl-capable fs)
if [ "$(stat -c '%u' "${TLS_DIR}/server.key")" != "100" ]; then
  if chown -R 100:100 "${TLS_DIR}" 2> /dev/null; then
    chmod 600 "${TLS_DIR}/server.key" "${TLS_DIR}/ca.key"
    log_ok "Ownership set to 100:100 (container user vault)"
  elif command -v setfacl > /dev/null && setfacl -m u:100:rX "${TLS_DIR}" &&
    setfacl -m u:100:r-- "${TLS_DIR}/server.key" "${TLS_DIR}/ca.key"; then
    log_ok "Granted uid 100 read access via POSIX ACL"
  else
    echo "[vault-tls][ERROR] Cannot make server.key readable by uid 100." >&2
    echo "  Run one of:" >&2
    echo "    sudo chown -R 100:100 ${TLS_DIR}" >&2
    echo "    setfacl -m u:100:rX ${TLS_DIR} && setfacl -m u:100:r-- ${TLS_DIR}/server.key ${TLS_DIR}/ca.key" >&2
    exit 1
  fi
fi

log_ok "Wrote ca.crt, server.crt, server.key to ${TLS_DIR}"
