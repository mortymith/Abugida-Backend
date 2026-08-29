# Restore PostgreSQL

## Prerequisites

- A valid Postgres backup file (`.dump` or `.sql.gz`) available locally or in S3
- `pg_restore` and `psql` available on the host
- Application services stopped or aware of the downtime
- **WARNING:** Restoring overwrites existing data. Confirm you have the correct backup file and understand the data loss window.

## Steps

1. **Identify the backup file** to restore. List available backups or download from S3 if needed.

   ```bash
   ls -lh data/backups/postgres/
   ```

2. **Run the restore recipe.** This stops the Postgres container, restores the specified dump into a fresh database, and restarts the service.

   ```bash
   just restore-postgres data/backups/postgres/latest.dump
   ```

   If the file is in S3, download it first and pass the local path.

3. **Wait for the restore to complete.** The script drops and recreates the target database, runs `pg_restore`, and restarts the container.

4. **Verify the database is accepting connections.**

   ```bash
   docker compose exec postgres-primary pg_isready
   ```

5. **Spot-check data integrity** by querying a known table.

   ```bash
   docker compose exec postgres-primary psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) FROM users;"
   ```

## Verification

- `pg_isready` returns "accepting connections".
- Row counts on key tables match expected values from the backup timestamp.
- `just health` passes.
- Application can connect and serve requests without errors.
- Replication catches up after restore (`just health-replication` shows low lag).
