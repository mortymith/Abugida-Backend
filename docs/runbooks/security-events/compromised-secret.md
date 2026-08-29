# Runbook: Compromised Secret

## Symptoms

- Security alert indicates a secret (database password, API key, token) has been exposed in logs, source code, or a breach notification.
- Vault audit log shows unauthorized access to a secret path.
- Service authentication failures spike after a credential leak.

## Impact

- An attacker with a compromised secret can access the associated service directly — database reads/writes, API impersonation, or Redis data manipulation. The blast radius depends on the scope of the leaked credential.

## Diagnosis

1. Identify which secret was compromised and its location (Vault path, environment variable, or config file):

   ```bash
   just vault-status
   docker exec infra_vault-1 vault kv get -mount=secret <path>
   ```

2. Check Vault audit logs for access to the affected secret:

   ```bash
   just logs vault | rg "<secret-path>"
   ```

3. Verify whether the secret is stored in Vault or injected via environment variables in Compose:

   ```bash
   docker compose -f compose.yml -f compose.prod.yml config | rg -i "<secret-name>"
   ```

## Resolution

1. Rotate the compromised secret using the appropriate Just recipe:

   ```bash
   just rotate-secrets --db
   ```

   Or target a specific system:

   ```bash
   just rotate-secrets --redis
   just rotate-secrets --api
   ```

2. If the secret is a Vault-stored database password, use the dedicated rotation:

   ```bash
   just vault-rotate-db-password
   ```

3. Restart all services that consume the rotated secret so they pick up the new value:

   ```bash
   just restart api && just restart dashboard && just restart marketing
   ```

4. If the secret was committed to version control, remove it from Git history using `git filter-repo` or BFG Repo Cleaner.

## Verification

1. Validate that all secrets are consistent and no stale values remain:

   ```bash
   just validate-secrets
   ```

2. Confirm the affected service authenticates successfully with the new credential:

   ```bash
   just logs api | tail -20
   ```

3. Run the full health suite:

   ```bash
   just health
   ```

4. Document the incident: compromised secret, rotation time, affected services, and any detected abuse.
