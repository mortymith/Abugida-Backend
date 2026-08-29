# MinIO

> **S3-compatible object storage** for file uploads, static assets, and application data blobs. Production includes a second MinIO instance for asynchronous cross-region disaster recovery.

---

## Overview

| Property           | Value                                      |
| ------------------ | ------------------------------------------ |
| **Image**          | `minio/minio:RELEASE.2025-09-07T16-13-09Z` |
| **S3 API Port**    | 9000                                       |
| **Console Port**   | 9001                                       |
| **Dev Host Ports** | 9000, 9001                                 |
| **Network**        | `infrastructure`                           |
| **Environments**   | All                                        |

Version is pinned to a specific release for reproducible deployments. MinIO follows a time-based release cadence with security patches and feature updates in each release.

---

## Bucket Initialisation

An init container (`init-minio`) built from `minio/mc:RELEASE.2025-04-22T01-43-23Z` runs on every compose start to ensure buckets and policies are in the correct state. The init script is **idempotent** — existing buckets and policies are not modified.

| Step | Action                   | Policy Attached                               |
| ---- | ------------------------ | --------------------------------------------- |
| 1    | Create `app-data` bucket | —                                             |
| 2    | Attach `readonly` policy | Public read access for CDN-served assets      |
| 3    | Attach `upload` policy   | Write-only access for upload endpoints        |
| 4    | Attach `app` policy      | Full CRUD for the application service account |

### IAM Policy Definitions

Policies are standard AWS IAM JSON files mounted into the init container:

| Policy File            | Permissions                            | Use Case                                                                |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `readonly-policy.json` | `s3:GetObject` on `app-data/*`         | Publicly-accessible static assets served through Caddy or CDN           |
| `upload-policy.json`   | `s3:PutObject` on `app-data/uploads/*` | Pre-signed upload endpoints allowing clients to write directly to MinIO |
| `app-policy.json`      | `s3:*` on `app-data/*`                 | Full bucket management, lifecycle operations, and administrative tasks  |

---

## Cross-Region Replication (Production)

In the production overlay, a second MinIO instance (`minio-backup`) is deployed as an asynchronous cross-region replication target:

```bash
mc replicate add minio-primary/app-data minio-backup/app-data
```

The backup instance:

- Runs on the `infrastructure` network with **no published ports** — not directly accessible.
- Automatically receives every object written to the primary bucket.
- Can be promoted to primary in a disaster recovery scenario via `scripts/restore/restore-minio.sh`.
- Replication is asynchronous and eventual-consistent.

---

## S3 Lifecycle Rules

A lifecycle rule (defined in `scripts/backup/s3-lifecycle/lifecycle-policy.json`) automatically transitions objects to the `STANDARD_IA` storage tier after 30 days, reducing costs for infrequently-accessed assets while keeping them immediately retrievable.

Applied via `just apply-s3-lifecycle` or `scripts/backup/apply-s3-lifecycle.sh`.

---

## Health Check

```yaml
healthcheck:
  test: ['CMD', 'curl', '-sf', 'http://localhost:9000/minio/health/live']
  interval: 15s
  timeout: 10s
  retries: 5
  start_period: 30s
```

MinIO exposes `/minio/health/live` returning HTTP 200 when accepting requests. The longer interval (15 s) and timeout (10 s) account for potential delays during bucket replication operations.

---

## Port Exposure

| Environment | Ports                             | Access Pattern                                                                                                          |
| ----------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dev         | `9000` (S3 API), `9001` (Console) | Published to host for local development and debugging                                                                   |
| Prod        | None published                    | Accessed exclusively via the `infrastructure` network; Console reachable through Caddy at `minio.localhost` in dev only |

---

## Backup & Recovery

| Operation | Script                             | Method                                         |
| --------- | ---------------------------------- | ---------------------------------------------- |
| Backup    | `scripts/backup/backup-minio.sh`   | `mc mirror`                                    |
| Restore   | `scripts/restore/restore-minio.sh` | Promote backup instance or `mc mirror` restore |

Step-by-step procedures are in the [data-operations runbooks](../runbooks/data-operations/backup-minio.md).

---

## Operational Notes

- **Full S3 compatibility** — Any tooling that works with AWS S3 (`aws-cli`, `s3cmd`, `boto3`) works with MinIO by pointing the endpoint URL to the container.
- **Init container lifecycle** — Runs as a one-shot job (`restart: "no"`) and exits after bucket creation succeeds.
- **Console access** — Available on port 9001 in dev only. In production, no ports are published to the host.
