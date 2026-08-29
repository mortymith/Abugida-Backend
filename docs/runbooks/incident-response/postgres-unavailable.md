# Runbook: PostgreSQL Unavailable

## Symptoms

- `pg_isready` returns no response or "rejecting connections."
- Applications report `FATAL: could not connect to server` or connection-refused errors.
- PgBouncer logs show `server conn error` or `pooler error`.

## Impact

- All services depending on Postgres (API, dashboard, marketing, SigNoz/ClickHouse if using PG for metadata) lose database access. Write-heavy workloads may queue and timeout. Active sessions are dropped.

## Diagnosis

1. Run the health check targeting Postgres:

   ```bash
   just health
   ```

2. Check the container status of both the primary and any replicas:

   ```bash
   docker ps -a --filter "name=infra_postgres"
   ```

3. Inspect Postgres logs for startup failures, WAL errors, or out-of-space messages:

   ```bash
   just logs postgres-primary
   ```

4. Verify disk space on the Postgres volume mount:

   ```bash
   docker exec infra_postgres-primary-1 df -h /var/lib/postgresql/data
   ```

5. Check `pg_hba.conf` for connectivity rules if connections are rejected:

   ```bash
   docker exec infra_postgres-primary-1 cat /var/lib/postgresql/data/pg_hba.conf
   ```

6. In production with streaming replication, check whether the primary has failed and a replica is still running:

   ```bash
   docker ps -a --filter "name=infra_postgres-replica"
   ```

## Resolution

1. If the primary is running but rejecting connections, restart PgBouncer first:

   ```bash
   just restart pgbouncer
   ```

2. If the primary crashed, restart it:

   ```bash
   just restart postgres-primary
   ```

3. In production, if the primary is dead and a replica is healthy, promote the replica by running the promotion entrypoint:

   ```bash
   docker exec infra_postgres-replica-1 /promote-replica.sh
   ```

4. Update PgBouncer's target to point to the new primary, then restart PgBouncer:

   ```bash
   just restart pgbouncer
   ```

5. If disk space caused the crash, expand the volume or clear WAL archives before restarting.

## Verification

1. Confirm `pg_isready` succeeds:

   ```bash
   docker exec infra_postgres-primary-1 pg_isready -U postgres
   ```

2. Run the full health suite:

   ```bash
   just health
   ```

3. Verify application connections recover by checking API logs:

   ```bash
   just logs api
   ```
