# Storage Cleanup

## Prerequisites

- Just CLI installed
- S3 credentials configured for lifecycle and prune operations
- Disk space report showing pressure (`just disk-usage`)
- Understanding of retention policies (how many days of backups to keep)

## Steps

1. **Check current disk usage** to understand what needs cleanup.

   ```bash
   just disk-usage
   ```

2. **Prune old local backups** beyond the configured retention period. This removes expired `.dump`, `.rdb.gz`, `.tar.gz`, and `.sql.gz` files from `data/backups/{type}/` directories.

   ```bash
   just backup-prune
   ```

3. **Apply S3 lifecycle policies** to tier older backups to cheaper storage classes (e.g., Glacier) and expire backups beyond maximum retention.

   ```bash
   just s3-lifecycle
   ```

4. **Manually clean Docker volumes** if disk pressure persists after pruning backups. Identify unused or orphaned volumes.

   ```bash
   docker volume ls -qf dangling=true
   docker volume prune -f
   ```

5. **Re-check disk usage** to confirm cleanup was effective.

   ```bash
   just disk-usage
   ```

## Verification

- `just disk-usage` shows reduced usage within acceptable thresholds.
- `just backup-prune` output lists the files it removed; no active backups were deleted.
- S3 lifecycle rules are visible via `aws s3api get-bucket-lifecycle-configuration`.
- `just backup-status` still shows valid recent backups for all types.
- Application services remain healthy (`just health`).
