# Restore MinIO

## Prerequisites

- A valid MinIO backup in S3 (created via `mc mirror`)
- `mc` (MinIO Client) installed with aliases for both local MinIO and remote S3
- Sufficient local disk space for the restored data
- **WARNING:** Restore overwrites local bucket contents. Ensure no active writes conflict.

## Steps

1. **Identify the backup snapshot** in S3 to restore from.

   ```bash
   mc ls REMOTE_ALIAS/backups/minio/ --recursive | head -20
   ```

2. **Run the restore recipe.** This mirrors data from S3 back into the local MinIO instance, bucket by bucket.

   ```bash
   just restore-minio s3://my-bucket/backups/minio/2024-01-15/
   ```

3. **Wait for the mirror to complete.** Large buckets may take time. Monitor progress in the script output.

4. **Verify no differences** remain between the S3 source and local MinIO.

   ```bash
   mc diff LOCAL_ALIAS/my-bucket REMOTE_ALIAS/backups/minio/2024-01-15/my-bucket
   ```

## Verification

- `mc diff` returns no output for all restored buckets.
- Object counts and total sizes match between source and local.
- A sample object is downloadable and correct via the application.
- `just health` shows MinIO as healthy.
- No permission or bucket-not-found errors in MinIO logs.
