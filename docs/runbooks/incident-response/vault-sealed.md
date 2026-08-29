# Runbook: Vault Sealed

## Symptoms

- `just vault-status` reports `Sealed = true`.
- Services starting up fail to retrieve secrets from Vault.
- Vault API returns HTTP 503 with a "vault is sealed" response body.

## Impact

- No new secrets can be read or written. Services that depend on Vault for database passwords, API keys, or TLS certificates will fail to start or operate. Existing in-memory secrets remain valid until service restart.

## Diagnosis

1. Check Vault status:

   ```bash
   just vault-status
   ```

   Or directly:

   ```bash
   docker exec infra_vault-1 vault status
   ```

2. Check Vault logs for seal-related messages or auto-unseal failures:

   ```bash
   just logs vault
   ```

3. Determine if the unseal keys are available:

   ```bash
   ls -la data/vault/init-output.json
   ```

4. If auto-unseal is configured (transit or cloud KMS), verify the auto-unseal backend is reachable.

## Resolution

1. If unseal keys are available, unseal Vault using the Just recipe (provides the 3 key threshold interactively):

   ```bash
   just vault-unseal
   ```

2. If the unseal keys are lost, check the init output:

   ```bash
   cat data/vault/init-output.json
   ```

3. **If no init output exists and keys are permanently lost**, you must re-initialize Vault. **WARNING: This destroys all stored secrets.**

   ```bash
   just vault-init
   ```

4. After re-initialization (or after unseal if secrets were wiped), re-populate all secrets:

   ```bash
   just vault-populate-secrets-run
   ```

5. Restart all services that depend on Vault to pick up the fresh secrets:

   ```bash
   just restart api && just restart dashboard && just restart marketing
   ```

## Verification

1. Confirm Vault reports `Sealed = false`:

   ```bash
   just vault-status
   ```

2. Test reading a known secret:

   ```bash
   docker exec infra_vault-1 vault kv get -mount=secret database/postgres
   ```

3. Run the full health suite to confirm all downstream services recovered:

   ```bash
   just health
   ```
