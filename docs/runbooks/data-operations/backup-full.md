# Full System Backup

## Prerequisites

- Just CLI installed and available in PATH
- All services (postgres, redis, minio) running and healthy (`just health`)
- S3-compatible storage configured with valid credentials in `.env.prod`
- Sufficient disk space in `data/backups/` for local staging
- Network connectivity to S3 endpoint

## Steps

1. **Run the full backup recipe.** This executes all five backup scripts sequentially: postgres, redis, minio, config, and monitoring.

   ```bash
   just backup-all
   ```

2. **Monitor the output.** Each backup script prints progress. Postgres runs `pg_dump` and uploads WAL segments. Redis triggers `SAVE` on the replica and uploads the RDB. Minio uses `mc mirror` per bucket. Config and monitoring data are archived and uploaded.

3. **Check backup status.** This reads `.last-backup` timestamp files from `data/backups/{type}/` and reports the age of each backup.

   ```bash
   just backup-status
   ```

4. **Verify backup integrity** across all types to confirm uploads succeeded and files are valid.

   ```bash
   just verify-backup
   ```

5. **Review the S3 lifecycle policy** if this is a scheduled backup. Tier older backups to cheaper storage classes.

   ```bash
   just s3-lifecycle
   ```

## Verification

- `just backup-status` shows all backups completed within the last hour.
- `just verify-backup` returns exit code 0 with no errors.
- S3 bucket contains fresh `.sql.gz`, `.rdb`, and `.tar.gz` files under the expected prefixes.
- Timestamp files in `data/backups/{type}/.last-backup` are current.
