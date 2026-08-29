# Storage Cleanup

Reclaim disk space across Docker layers, backups, ClickHouse data, and MinIO objects.

## Prerequisites

- `just` CLI installed
- Verify MinIO lifecycle rules before deleting objects
- At least 10% disk free required to run prune safely

## Steps

1. **Check disk usage across all volumes**

   ```bash
   just disk-usage
   ```

   Identify the largest consumers: Docker images, volumes, backup files.

2. **Prune old backups**

   ```bash
   just backup-prune
   ```

   Removes local backup files older than the retention period defined in `.env`.

3. **Clean Docker system (dangling images, unused networks, build cache)**

   ```bash
   docker system prune -af --volumes
   ```

   This removes unused images, stopped containers, and dangling volumes. Running containers are unaffected.

4. **Trigger ClickHouse TTL cleanup**

   ```bash
   docker exec clickhouse-1 clickhouse-client -q "OPTIMIZE TABLE traces FINAL;"
   ```

   ClickHouse TTL policies automatically expire old trace data; `OPTIMIZE` forces immediate cleanup.

5. **Review and apply MinIO lifecycle rules**
   ```bash
   just s3-lifecycle
   ```
   Confirm lifecycle rules expire multipart uploads and versioned objects per policy. Manually clean if needed:
   ```bash
   docker exec minio-1 mc rm --recursive --older-than 30d myminio/mybucket/prefix/
   ```

## Verification

- `just disk-usage` shows meaningful space reclaimed
- `just health all` passes — no volumes accidentally removed
- MinIO objects still accessible via application
- ClickHouse queries return current data (no unintended data loss)
- Backup retention complies with policy: `just backup-prune --dry-run`
