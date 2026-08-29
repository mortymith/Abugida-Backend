# Database Migration

## Prerequisites

- A tested migration script committed to the repository
- Current database backup completed (`just backup-postgres`)
- Access to run commands inside the API container
- Maintenance window or application in read-only mode if the migration is destructive
- `bun` runtime available inside the API container

## Steps

1. **Take a pre-migration backup** in case rollback is needed.

   ```bash
   just backup-postgres
   ```

2. **Execute the migration** inside the API container using the Just shell shortcut.

   ```bash
   just shell api
   bun run migrate
   ```

   This runs all pending migrations in order. Review the output for errors.

3. **Check replication status** to confirm replicas have applied the schema changes.

   ```bash
   just health-replication
   ```

4. **Verify data integrity** by running application-level checks or spot queries against affected tables.

   ```bash
   just shell api
   bun run migrate:verify
   ```

5. **If issues arise, roll back.** Restore from the backup taken in step 1.

   ```bash
   just restore-postgres data/backups/postgres/latest.dump
   ```

   If the migration supports reverse migrations, run `bun run migrate:down` instead.

## Verification

- `bun run migrate` exits with code 0 and reports all migrations applied.
- `just health-replication` shows zero or minimal replication lag.
- Application serves requests without schema-related errors.
- Spot queries on migrated tables return expected results.
- `just health` passes all checks.
