# ADR-017: Docker Secrets for Development

## Status

**Deprecated by ADR-006**

## Context

Development environments need access to the same secrets as production—database credentials, API keys, signing tokens—but running a full HashiCorp Vault instance locally adds significant operational overhead and complexity for a workflow that is inherently non-sensitive.

## Decision

~~Use native Docker secrets for the development environment. Secret values are stored as plain files in a `secrets/` directory at the project root and declared in the development compose file with the `secrets` block. Containers mount these files at `/run/secrets/<name>`, matching the same mount path used in production. This keeps the application code path for reading secrets identical across environments without requiring a Vault agent sidecar.~~

**Superseded by ADR-006:** Development now uses `.env` environment variables directly, eliminating Docker secrets entirely. This simplification was adopted because the Docker secrets approach required maintaining a `secrets/` directory with individual files and a `docker/compose/secrets.yml` mapping file, adding complexity without meaningful security benefit for local development. The Vault codepath for production remains unchanged.

## Consequences

**Positive (original):** Developers got a working secrets workflow with zero additional infrastructure—no Vault server, no tokens, no agent containers. The application reads secrets from `/run/secrets/` in both dev and prod, eliminating environment-specific code branches.

**Negative (original):** Secrets were plaintext files. This was accepted because development secrets are non-production credentials with no real-world exposure risk.

**Migration:** The `secrets/` directory and `docker/compose/secrets.yml` are being removed. All 8 Docker secrets (postgres_password, redis_password, redis_admin_password, redis_readonly_password, redis_sentinel_password, minio_root_password, api_secret_key, powersync_db_password — now split into ps_replication_password + ps_storage_password per ADR-025) are replaced by environment variables in `.env` for development.
