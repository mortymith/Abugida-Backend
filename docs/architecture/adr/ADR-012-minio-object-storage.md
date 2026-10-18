# ADR-012: MinIO for S3-compatible object storage

## Status

Accepted

## Context

The platform needs object storage for file uploads, static assets, and application data blobs — content that does not belong in PostgreSQL. Options:

- **AWS S3 (or an equivalent managed service)**: Fully managed and durable, but introduces per-request and egress cost, a cloud/vendor dependency for a self-hosted Compose platform, and latency for workloads co-located with the databases.
- **Local filesystem / Docker volume**: Simple, but has no HTTP API, no presigned uploads, no versioning or replication, and cannot be shared cleanly across service replicas.
- **MinIO**: S3-compatible, self-hosted, runs as a normal container on the `infrastructure` network, supports IAM policies, versioning, and cross-region replication.

The Application services need an S3 API (SDKs, presigned URLs) without a hard dependency on a specific cloud provider.

## Decision

Adopt **MinIO** as the S3-compatible object storage backend.

- **Image**: a pinned MinIO release (never `:latest`), network `infrastructure`, ports 9000 (S3 API) and 9001 (console, dev only).
- **Bucket initialisation**: an idempotent one-shot `init-minio` container (built from `minio/mc`) runs on every stack start and ensures the `app-data` bucket and its policies exist; existing buckets and policies are left untouched.
- **IAM policies**: three least-privilege policies are attached to the bucket (detailed in ADR-015).
- **Lifecycle**: a rule transitions objects to the `STANDARD_IA` storage tier after 30 days to control cost for infrequently accessed assets.
- **Disaster recovery**: production runs a second MinIO instance (`minio-backup`) as an asynchronous cross-region replication target (ADR-016).
- **Compatibility**: the endpoint speaks the S3 API, so `aws-cli`, `s3cmd`, `boto3`, and MinIO's own `mc` all work against it.
- **Exposure**: in production no ports are published; in development the console is reachable through Caddy at `minio.localhost`.

## Consequences

### Positive

- **No vendor lock-in or egress costs**: storage stays inside the platform's own network.
- **Standard interface**: the S3 API means application code is portable to a managed service later if needed.
- **Integrated with the stack**: MinIO lives on the internal `infrastructure` network, so it benefits from the same network isolation (ADR-004) and secret management (ADR-006) as the databases.
- **Durability features**: versioning, replication, lifecycle rules, and presigned URLs are available without additional components.

### Negative

- **Operational responsibility**: backup, restore, upgrade, and disk capacity are now ours to manage.
- **Init-container ordering**: buckets and policies must exist before the application writes; a failed init blocks dependents.
- **Time-based releases**: MinIO's release cadence is date-based, so upgrades are version-churn-heavy and need testing.

### Risks

- **Data loss if unbacked**: the primary volume is a single point of failure until replication is enabled. Backup (`mc mirror`) plus production CRR (ADR-016) mitigate this.
- **Policy misconfiguration**: an overly broad policy exposes data. Policies are version-controlled JSON reviewed with the rest of the config (`scripts/security/check-configs.sh`).
- **Lifecycle/versioning interaction**: versioned objects plus lifecycle transitions can surprise operators on storage growth; lifecycle policy is reviewed alongside retention.

## References

- MinIO service: `docs/services/minio.md`
- Bucket policies: ADR-015 · Versioning & CRR: ADR-016
- Policy files: `docker/config/minio/policies/` · Lifecycle: `scripts/backup/s3-lifecycle/`
- Network isolation: ADR-004 · Secret layering: ADR-006
