# Backup Redis

## Prerequisites

- Redis replica is running and reachable on the 3-layer network
- S3 credentials configured for backup upload
- `redis-cli` and `redis-check-rdb` available on the host
- Just CLI installed

## Steps

1. **Trigger the backup recipe.** This connects to the Redis replica and issues a `SAVE` command, which blocks the replica briefly to produce a point-in-time RDB snapshot.

   ```bash
   just backup-redis
   ```

2. **Wait for the script to complete.** It copies the resulting `.rdb` file from the Redis data volume, compresses it with gzip, and uploads it to the S3 backup path under the `redis/` prefix. A `.last-backup` timestamp file is written to `data/backups/redis/`.

3. **Verify the RDB file integrity** before considering the backup successful.

   ```bash
   redis-check-rdb /path/to/latest-dump.rdb
   ```

4. **Confirm the backup status** shows a fresh Redis entry.

   ```bash
   just backup-status
   ```

## Verification

- `redis-check-rdb` reports no errors and prints the RDB version and number of keys.
- `just backup-status` shows the Redis backup age under the configured threshold.
- The compressed `.rdb.gz` file exists in S3 at the expected timestamped path.
- The `.last-backup` file in `data/backups/redis/` matches the current timestamp.
