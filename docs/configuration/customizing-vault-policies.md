# Customizing Vault Policies

HashiCorp Vault policies define which paths and operations a token or AppRole is allowed to access. Policies are written in HashiCorp Configuration Language (HCL) and stored in `docker/config/vault/policies/`.

## Policy File Location

```
docker/config/vault/policies/
├── admin-policy.hcl    # Full management — human operators only
├── app-policy.hcl      # Application service access — AppRole scoped
└── pki-policy.hcl       # Certificate issuance — mTLS for internal services
```

## HCL Policy Format

Each policy file contains `path` blocks that grant capabilities to specific Vault paths:

```hcl
path "secret/data/app/*" {
  capabilities = ["read"]
}
```

Available capabilities:

| Capability | Effect                                                     |
| ---------- | ---------------------------------------------------------- |
| `create`   | Create a new key (KV-v2: `POST`)                           |
| `read`     | Read a key's value                                         |
| `update`   | Update an existing key (KV-v2: `POST` to existing path)    |
| `delete`   | Delete a key                                               |
| `list`     | List keys under a path                                     |
| `sudo`     | Allow root-level operations (e.g., access to `sys/` paths) |

Vault enforces **default-deny**: any path not explicitly granted is blocked.

## Existing Policies

### admin-policy.hcl

Full management access for human operators. Never assigned to application AppRoles.

| Path Pattern     | Capabilities                             | Purpose                       |
| ---------------- | ---------------------------------------- | ----------------------------- |
| `secret/*`       | create, read, update, delete, list, sudo | All KV-v2 secrets             |
| `database/*`     | create, read, update, delete, list, sudo | Database engine configuration |
| `pki/*`          | create, read, update, delete, list, sudo | PKI engine management         |
| `auth/approle/*` | create, read, update, delete, list, sudo | AppRole management            |
| `sys/*`          | create, read, update, delete, list, sudo | System paths, policies, audit |

### app-policy.hcl

Scoped read access for application services (API, Dashboard, Marketing) via AppRole.

| Path Pattern                   | Capabilities   | Purpose                           |
| ------------------------------ | -------------- | --------------------------------- |
| `secret/data/app/api/*`        | read           | API service secrets               |
| `secret/data/app/dashboard/*`  | read           | Dashboard service secrets         |
| `secret/metadata/app/*`        | list, read     | Key discovery under `app/`        |
| `database/creds/app-readonly`  | read           | Dynamic read-only DB credentials  |
| `database/creds/app-readwrite` | read           | Dynamic read-write DB credentials |
| `pki/issue/app-internal`       | create, update | Request internal TLS certificates |
| `pki/cert/ca_chain`            | read           | Fetch CA chain for verification   |

### pki-policy.hcl

Certificate issuance for internal mTLS.

| Path Pattern                | Capabilities   | Purpose                           |
| --------------------------- | -------------- | --------------------------------- |
| `pki/issue/internal-server` | create, update | Server certificates               |
| `pki/issue/internal-client` | create, update | Client mTLS certificates          |
| `pki/issue/app-internal`    | create, update | Application-specific certificates |
| `pki/cert/ca_chain`         | read           | CA chain download                 |
| `pki/crl`                   | read           | Certificate revocation list       |
| `pki/roles/*`               | list, read     | Role discovery                    |

## Adding a New Policy

1. **Create the HCL file** in `docker/config/vault/policies/`:

```hcl
# docker/config/vault/policies/worker-policy.hcl
path "secret/data/app/worker/*" {
  capabilities = ["read"]
}

path "database/creds/worker-readwrite" {
  capabilities = ["read"]
}

path "pki/issue/app-internal" {
  capabilities = ["create", "update"]
}

path "pki/cert/ca_chain" {
  capabilities = ["read"]
}
```

2. **Load the policy via `vault-secrets.sh`** or manually:

```bash
# After Vault is unsealed and authenticated
vault policy write worker docker/config/vault/policies/worker-policy.hcl
```

3. **Assign the policy to an AppRole or identity**:

```bash
vault write auth/approle/role/worker \
  token_policies="worker-policy" \
  token_ttl=1h \
  token_max_ttl=4h
```

4. **Verify the policy**:

```bash
vault policy read worker
vault policy list
```

## Applying Policies During Bootstrap

Policies are loaded by `scripts/security/vault-secrets.sh` during `just vault-populate-secrets`. The script reads all `.hcl` files from `docker/config/vault/policies/` and writes them to Vault sequentially. If you add a new policy file, it will be picked up automatically on the next `vault-populate-secrets` run.
