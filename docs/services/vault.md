# HashiCorp Vault

> **Centralised secrets management** for the production environment. The source of truth for all secrets in staging and production. Development uses `.env` environment variables instead (ADR-006).

---

## Overview

| Property         | Value                         |
| ---------------- | ----------------------------- |
| **Image**        | `hashicorp/vault:1.18-alpine` |
| **Network**      | `infrastructure`              |
| **Environments** | Production only               |

---

## Configuration Files

| File                                           | Purpose                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docker/config/vault/vault-config.hcl`         | Raft storage backend, TCP+TLS listener, `disable_mlock` toggle for containers without IPC_LOCK   |
| `docker/config/vault/scripts/vault-init.sh`    | Executes `vault operator init`, captures unseal keys and root token to a local secrets directory |
| `docker/config/vault/scripts/vault-unseal.sh`  | Reads unseal keys and applies them to transition Vault from sealed to unsealed state             |
| `docker/config/vault/scripts/vault-secrets.sh` | Enables secrets engines, writes policies, and configures dynamic credential generation           |

---

## Bootstrap Sequence

Vault requires a strict three-phase manual bootstrap before it can serve secrets. Orchestrated via Just recipes:

### Phase 1 — Initialisation (one-time per environment)

```bash
just vault-init
```

Initialises the Raft storage backend, generates 5 unseal keys (key threshold: 3), and a root token. Keys and token are written to a local directory that is **never committed to version control**. If these keys are lost, Vault data is irrecoverable.

### Phase 2 — Unseal (on every container restart)

```bash
just vault-unseal
```

Vault starts in a **sealed** state on every container restart. Unseal applies the stored keys to decrypt the storage backend. Vault must be unsealed before any secrets operations can succeed.

### Phase 3 — Populate Secrets & Policies

```bash
just vault-populate-secrets
```

Enables the required secrets engines, writes access policies, and configures dynamic credential generation for PostgreSQL. Runs after initialisation and after any policy change.

---

## Secrets Engines

| Engine   | Path        | Purpose                                                             |
| -------- | ----------- | ------------------------------------------------------------------- |
| KV v2    | `secret/`   | General-purpose key-value secrets (API keys, tokens, configuration) |
| Database | `database/` | Dynamic short-lived PostgreSQL credentials generated on demand      |
| PKI      | `pki/`      | Internal TLS certificate issuance for service-to-service mTLS       |

---

## Access Policies

| Policy             | Path Access                                                  | Intended Consumer                                     |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------------- |
| `admin-policy.hcl` | `sys/*`, `secret/*`, `database/*`, `pki/*` (full management) | Platform operators and CI/CD pipelines                |
| `app-policy.hcl`   | `database/creds/app-role` (read), `secret/data/app/*` (read) | Application services obtaining dynamic DB credentials |
| `pki-policy.hcl`   | `pki/issue/*`, `pki/certs` (list, issue)                     | Services requesting internal TLS certificates         |

---

## Security Hardening

```yaml
cap_add:
  - IPC_LOCK
environment:
  VAULT_SKIP_VERIFY: 'true'
```

| Setting                 | Purpose                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`IPC_LOCK`**          | Prevents Vault's encrypted data from being paged to the host's swap file. Without this, sensitive material could persist on disk unencrypted.         |
| **`VAULT_SKIP_VERIFY`** | Allows self-signed TLS certificates during initial bootstrap. Production overlays should mount a real CA-signed certificate and remove this override. |

---

## Health Check

```yaml
healthcheck:
  test: ['CMD', 'vault', 'status']
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 30s
```

`vault status` returns exit code 0 when unsealed and operational, exit code 2 when sealed — a reliable readiness indicator.

---

## Operational Notes

- **Production-only.** Dev and staging environments inject secrets via Docker Compose `secrets:` blocks backed by filesystem files.
- **Credential TTL.** Dynamic database credentials are short-lived (default TTL: 1 hour). The API service must periodically re-authenticate to obtain fresh credentials.
- **Single source of truth.** The `vault-secrets.sh` script is the canonical source for engine and policy state. Manual `vault` CLI commands should not be used to modify state, as they would diverge from version-controlled configuration.
- **Unseal is required on every restart.** Automate this in your deployment runbook or use Vault's auto-unseal feature with a cloud KMS.
