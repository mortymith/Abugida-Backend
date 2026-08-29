# Backup MinIO

## Prerequisites

- MinIO is running and accessible via the internal network
- `mc` (MinIO Client) installed and configured with an alias pointing to the local MinIO instance
- S3-compatible remote storage configured as a second `mc` alias
- Sufficient bandwidth and S3 storage quota

## Steps

1. **Run the MinIO backup recipe.** This executes `backup-minio.sh`, which iterates over each bucket and uses `mc mirror` to synchronize contents to the remote S3 target. Metadata and versioning information are preserved.

   ```bash
   just backup-minio
   ```

2. **Watch the output** for per-bucket progress. Large buckets may take significant time. The script updates `.last-backup` in `data/backups/minio/` upon completion.

3. **Verify no differences exist** between local and remote after the mirror completes.

   ```bash
   mc diff LOCAL_ALIAS/bucket REMOTE_ALIAS/backups/minio/bucket
   ```

   Repeat for each bucket. An empty diff output means the backup is consistent.

4. **Confirm backup status** shows a fresh entry.

   ```bash
   just backup-status
   ```

## Verification

- `mc diff` returns no output for all buckets (perfect sync).
- Object counts match between local and remote S3.
- `just backup-status` shows the MinIO backup timestamp is current.
- A sample object downloaded from S3 matches the local copy (`mc cat` + checksum comparison).
- The `.last-backup` file in `data/backups/minio/` reflects the completion time.
