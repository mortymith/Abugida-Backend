# ADR-015: MinIO bucket policies (readonly, upload, app)

## Status

Accepted

## Context

Once object storage is in place (ADR-012), access to the `app-data` bucket must be scoped. A single bucket-wide credential would give every consumer — the publicly facing asset server, the upload endpoint, and the application's own administrative code — the same rights. That over-exposes the bucket: a compromised upload path could then read or delete every object.

The bucket serves three distinct use cases with different trust levels:

1. **Public assets** that are read by clients/CDN and must never be writable by them.
2. **Client uploads**, where a presigned URL must permit writing a new object but not reading others or deleting anything.
3. **Application administration**, which needs full CRUD and lifecycle control.

## Decision

Define **three least-privilege IAM policies** as standard AWS IAM JSON files, mounted into the idempotent `init-minio` container and attached to the `app-data` bucket on every stack start:

| Policy File            | Permissions                            | Use Case                                                               |
| ---------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `readonly-policy.json` | `s3:GetObject` on `app-data/*`         | Publicly accessible static assets served through Caddy or a CDN        |
| `upload-policy.json`   | `s3:PutObject` on `app-data/uploads/*` | Presigned upload endpoints letting clients write directly to MinIO     |
| `app-policy.json`      | `s3:*` on `app-data/*`                 | Full bucket management, lifecycle operations, and administrative tasks |

Placement and lifecycle:

- The policy files live in `docker/config/minio/policies/` and are version-controlled.
- `init-minio` is idempotent — it creates the bucket and attaches policies only when they are absent, so re-running it is safe.
- Read access is intentionally bucket-scoped (`app-data/*`); the upload policy is further scoped to the `uploads/` prefix so a write credential cannot overwrite existing top-level assets.

## Consequences

### Positive

- **Least privilege**: each consumer gets exactly the rights it needs; the public reader cannot write and the uploader cannot read or delete.
- **Blast-radius containment**: a leaked presigned URL or upload credential is limited to putting objects under `uploads/`.
- **Auditable**: policies are plain JSON in git and reviewed like any other config.

### Negative

- **Three credentials to manage**: rotation and distribution are more involved than a single key. This is handled by the tiered secrets strategy (ADR-006).
- **Prefix discipline**: the upload scope depends on callers writing under the intended prefix; application code must honour it.
- **Init ordering**: dependents need `init-minio` to have completed before they can assume the bucket/policy state exists.

### Risks

- **Policy drift**: if a policy file is edited to broaden access, the change is silent at runtime. The config check (`scripts/security/check-configs.sh`) and review are the guard.
- **Presigned URL lifetime**: a long-lived presigned URL extends the window of the upload permission. Lifetimes are kept short and the policy scope is narrow.

## References

- MinIO service: `docs/services/minio.md`
- Policy files: `docker/config/minio/policies/`
- Object storage decision: ADR-012 · Versioning & CRR: ADR-016 · Secret layering: ADR-006
