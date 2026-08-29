# Certificate Rotation

Force-renew TLS certificates and reissue via Vault PKI. Caddy auto-obtains certs from Vault; manual rotation is needed for expiring or compromised certs.

## Prerequisites

- `just` CLI installed
- Vault unsealed and accessible
- Confirm current cert expiry: `just cert-status`

## Steps

1. **Check current certificate status and expiry**

   ```bash
   just cert-status
   ```

   Note expiry dates for all domains. Rotate if within 14 days of expiry.

2. **Force renewal in Vault PKI**

   ```bash
   just cert-force-renewal
   ```

   This revokes old certs and issues new ones through the Vault PKI intermediate CA.

3. **Reload Caddy to pick up new certificates**

   ```bash
   just restart caddy
   just health caddy
   ```

   Both Caddy replicas fetch the renewed cert from Vault on startup.

4. **Verify new certificate is served**
   ```bash
   just cert-status
   echo | openssl s_client -connect $DOMAIN_API:443 -servername $DOMAIN_API 2>/dev/null | openssl x509 -noout -dates
   ```

## Verification

- `just cert-status` shows new expiry date (>80 days out)
- `openssl s_client` confirms new cert on both Caddy replicas
- No TLS handshake errors in `just logs caddy`
- Vault PKI shows no revoked certs still in use
