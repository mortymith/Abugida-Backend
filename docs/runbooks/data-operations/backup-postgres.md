# Backup PostgreSQL

## Prerequisites

- PostgreSQL primary is running and accepting connections
- `pg_dump` and `pg_restore` available on the host
- S3 credentials configured in environment (`.env.prod`)
- Sufficient disk space in `data/backups/postgres/` for the dump

## Steps

1. **Run the Postgres backup recipe.** This executes `backup-postgres.sh`, which runs `pg_dump` with custom format against the primary, compresses the output, and uploads WAL segments to S3 for point-in-time recovery.

   ```bash
   just backup-postgres
   ```

2. **Inspect the backup contents** without restoring. Use `pg_restore --list` on the dump file to confirm all expected schemas, tables, and large objects are included.

   ```bash
   pg_restore --list data/backups/postgres/latest.dump
   ```

3. **Check backup status** to confirm the `.last-backup` timestamp was updated.

   ```bash
   just backup-status
   ```

4. **Verify WAL segments** were uploaded to S3 if point-in-time recovery is required.

   ```bash
   aws s3 ls s3://$S3_BUCKET/backups/postgres/wal/ --recursive | tail -5
   ```

## Verification

- `pg_restore --list` outputs a complete table of contents with no errors.
- `just backup-status` shows a fresh Postgres backup timestamp.
- WAL files exist in S3 for the backup period.
- The compressed dump file in `data/backups/postgres/` matches expected size (compare to previous backups).
- Replication lag on replicas remains low (`just health-replication`).
