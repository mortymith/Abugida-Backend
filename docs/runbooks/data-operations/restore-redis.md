# Restore Redis

## Prerequisites

- A valid Redis RDB backup file (`.rdb` or `.rdb.gz`) available locally or in S3
- Redis container can be stopped and restarted
- Application tolerates cache warmup after restore
- **WARNING:** This replaces all in-memory data. Current cache contents will be lost.

## Steps

1. **Identify the backup file** to restore.

   ```bash
   ls -lh data/backups/redis/
   ```

2. **Run the restore recipe.** This stops the Redis container, decompresses and copies the RDB file into the Redis data volume, and restarts the service.

   ```bash
   just restore-redis data/backups/redis/latest.rdb.gz
   ```

3. **Wait for Redis to load the RDB** on startup. Check the container logs for the loading progress message.

   ```bash
   docker compose logs redis-primary --tail 20
   ```

4. **Verify Redis is responding** and has loaded the keys.

   ```bash
   docker compose exec redis-primary redis-cli ping
   docker compose exec redis-primary redis-cli DBSIZE
   ```

## Verification

- `redis-cli ping` returns `PONG`.
- `DBSIZE` returns a non-zero key count consistent with the backup.
- `just health` shows Redis as healthy.
- Application cache hit rates recover within expected warmup period.
- No errors in Redis logs after startup.
