# Runbook: TLS Certificate Expired

## Symptoms

- Browser shows `NET::ERR_CERT_DATE_INVALID` or similar warnings.
- API clients fail TLS handshake with `certificate has expired` errors.
- Caddy logs report ACME errors or failed certificate renewals.
- Internal services using Vault PKI fail mutual TLS verification.

## Impact

- All HTTPS traffic to public endpoints is broken. Internal service-to-service mTLS connections may fail if using Vault-issued certificates. External integrations (webhooks, third-party APIs calling back) are disrupted.

## Diagnosis

1. Check certificate status across all domains:

   ```bash
   just cert-status
   ```

2. Review Caddy logs for ACME or certificate-related errors:

   ```bash
   just logs caddy-active | rg -i "certificate\|acme\|tls\|renew"
   ```

3. Verify the Caddy ACME issuer configuration in the Compose overlay:

   ```bash
   docker compose -f compose.yml -f compose.prod.yml config | rg "CADDY_ACME_ISSUER"
   ```

4. Check DNS records for all production domains to ensure they resolve to the correct IP or CNAME:

   ```bash
   dig +short app.example.com
   dig +short signoz.example.com
   ```

5. If using Vault PKI for internal certificates, check the Vault PKI role and CA status:

   ```bash
   docker exec infra_vault-1 vault secrets list
   docker exec infra_vault-1 vault read pki/intermediate/cert
   ```

## Resolution

1. If Caddy failed to auto-renew, force a renewal:

   ```bash
   just cert-force-renewal
   ```

2. If DNS records are incorrect or missing, update them with your DNS provider to point to the Caddy VIP or Cloudflared tunnel.

3. If the ACME issuer is misconfigured (e.g., staging vs. production), update the environment variable and restart:

   ```bash
   docker compose -f compose.yml -f compose.prod.yml config | rg "CADDY_ACME_ISSUER"
   # Edit compose.prod.yml to set CADDY_ACME_ISSUER=letsencrypt-prod
   just restart caddy-active && just restart caddy-standby
   ```

4. For Vault PKI internal certificates, renew or re-issue:

   ```bash
   docker exec infra_vault-1 vault write pki/issue/my-role common_name="infra-internal" ttl="720h"
   ```

## Verification

1. Confirm certificate validity:

   ```bash
   just cert-status
   ```

2. Test HTTPS connectivity to public endpoints:

   ```bash
   curl -v https://app.example.com 2>&1 | rg "expire\|subject\|issuer"
   ```

3. Run full health:

   ```bash
   just health
   ```

4. Verify no TLS errors in application or Caddy logs:

   ```bash
   just logs caddy-active | tail -20
   ```
