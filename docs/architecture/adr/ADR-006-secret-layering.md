# ADR-006: Secret Layering (Dev .env, Staging/Prod Vault)

## Status

Accepted

## Context

The infrastructure requires secrets for database credentials, Redis ACL tokens, MinIO access keys, Vault tokens, Cloudflare tunnel tokens, and API signing keys. These secrets must be managed differently depending on the environment:

- **Development**: Operators need a frictionless experience. Requiring a full Vault cluster for local development adds unnecessary complexity and startup time. Secrets can be environment variables in a gitignored `.env` file.
- **Staging & Production**: Secrets must be encrypted at rest, auditable, have short lifetimes, and support rotation without redeployment. Plaintext environment variables are unacceptable.

Previous approaches considered and evolved through:

1. **Docker secrets everywhere**: Simple, but Docker secrets are just bind-mounted files with no encryption, TTL, or audit logging. Unacceptable for production. This was the initial approach (ADR-017).
2. **Docker secrets in dev + Vault in prod**: Balanced, but Docker secrets added unnecessary complexity for development when `.env` variables are simpler and equally secure for local-only use.
3. **Environment variables everywhere**: Easiest, but `docker inspect` leaks all env vars. Security anti-pattern for production.
4. **Vault everywhere**: Secure, but Vault requires init, unseal, policy configuration, and an unseal key management strategy — heavy for local development.

We need a solution that is simple for developers and robust for staging and production.

## Decision

Implement a two-tier secret management strategy:

### Development: .env Environment Variables

- Secrets are stored as environment variables in the `.env` file (gitignored via `.gitignore`).
- Docker Compose reads `.env` automatically and injects values into container environment.
- No Docker secrets infrastructure, no Vault cluster — just a flat `.env` file.
- This is the simplest possible approach, appropriate for local development where security requirements are minimal.

```bash
# .env (gitignored)
POSTGRES_PASSWORD=dev-local-password
REDIS_PASSWORD=dev-local-password
MINIO_ROOT_PASSWORD=dev-local-password
```

### Staging & Production: HashiCorp Vault

- Vault server runs on the infrastructure network (port 8200, not published to host in prod, published in staging for debugging).
- **Bootstrap sequence** (`just vault:init`):
  1. `vault operator init` — generates root token and 5 unseal keys (Shamir's Secret Sharing, threshold=3).
  2. Store unseal keys securely (e.g., 1Password vault, split across operators).
  3. `vault operator unseal` — with 3 of 5 keys.
  4. Configure secret engines: `database/`, `redis/`, `pki/`.
  5. Create ACL policies for each application service.
  6. `just vault:populate` — seed initial secrets from CI environment.

- **Dynamic credentials**: Application services request short-lived credentials from Vault at startup and on rotation. PostgreSQL roles, Redis ACL tokens, and MinIO STS credentials are auto-generated with a 1-hour TTL.

- **PKI**: Vault's PKI backend issues internal mTLS leaf certificates for service-to-service communication.

### How Services Detect the Environment

Services check for the presence of the `VAULT_ADDR` environment variable. If present, they use Vault dynamic credentials. If absent (dev), they fall back to reading environment variables directly.

### Migration from Docker Secrets

The 8 Docker secrets previously defined in `docker/compose/secrets.yml` are being removed:

| Secret                    | Previous Location                      | New Dev Approach                  | New Prod Approach        |
| ------------------------- | -------------------------------------- | --------------------------------- | ------------------------ |
| `postgres_password`       | `/run/secrets/postgres_password`       | `POSTGRES_PASSWORD` env var       | Vault dynamic credential |
| `redis_password`          | `/run/secrets/redis_password`          | `REDIS_PASSWORD` env var          | Vault dynamic credential |
| `redis_admin_password`    | `/run/secrets/redis_admin_password`    | `REDIS_ADMIN_PASSWORD` env var    | Vault dynamic credential |
| `redis_readonly_password` | `/run/secrets/redis_readonly_password` | `REDIS_READONLY_PASSWORD` env var | Vault dynamic credential |
| `redis_sentinel_password` | `/run/secrets/redis_sentinel_password` | `REDIS_SENTINEL_PASSWORD` env var | Vault dynamic credential |
| `minio_root_password`     | `/run/secrets/minio_root_password`     | `MINIO_ROOT_PASSWORD` env var     | Vault dynamic credential |
| `api_secret_key`          | `/run/secrets/api_secret_key`          | `API_SECRET_KEY` env var          | Vault dynamic credential |
| `ps_replication_password` | —                                      | `PS_REPLICATION_PASSWORD` env var | Vault dynamic credential |
| `ps_storage_password`     | —                                      | `PS_STORAGE_PASSWORD` env var     | Vault dynamic credential |

## Consequences

### Positive

- **Developer experience**: `just dev` in dev works immediately after setting up `.env`. No Vault setup required, no Docker secrets to generate.
- **Production security**: All production credentials are dynamic, time-limited, and auditable through Vault's audit log device.
- **Simplicity**: Removed the Docker secrets infrastructure entirely for dev. One less moving part, one less file to manage.
- **Rotation**: Dynamic credentials expire automatically. No manual rotation process for database passwords or API keys.
- **Audit trail**: Vault logs every secret read, enabling forensic analysis of credential access.

### Negative

- **Bootstrap complexity**: Staging/prod deployment requires the Vault init/unseal/populate sequence before application services can start. This is a prerequisite step that must be automated in CI.
- **Two codepaths**: Application code must handle both env-var-based and Vault-based secret retrieval. This is typically abstracted behind a secrets client library.
- **Unseal key management**: Lost unseal keys mean lost access to Vault. The Shamir key sharing scheme requires multiple operators or a secure key storage solution.
- **Migration effort**: Removing Docker secrets requires updating all service definitions in compose files and any scripts that reference `/run/secrets/`.

### Risks

- **Dev secret exposure**: The `.env` file is plaintext. If a developer accidentally commits it, all credentials are exposed. Mitigated by `.gitignore` and a pre-commit hook that scans for secrets.
- **Vault unavailability**: If Vault is down, production services cannot obtain new credentials. Existing credentials continue to work until TTL expires. A Vault HA cluster (Raft storage) mitigates single-node failure.
