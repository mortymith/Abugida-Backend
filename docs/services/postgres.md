# PostgreSQL 17

> **Primary relational data store** for the entire platform — application data, authentication records, and business logic state. Accessed exclusively through PgBouncer in all environments, with one documented exception.

---

## Overview

| Property           | Value                |
| ------------------ | -------------------- |
| **Image**          | `postgres:17-alpine` |
| **Container Port** | 5432                 |
| **Dev Host Port**  | 5432                 |
| **Network**        | `infrastructure`     |
| **Environments**   | All                  |

The Alpine variant minimises image size while retaining full PostgreSQL capability. Version pinning to major release `17` ensures reproducible builds and avoids unexpected breaking changes during minor version bumps.

---

## Configuration Files

All configuration is externalised via bind-mounted files, keeping the image generic and environment-agnostic:

| File                                          | Purpose                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/config/postgres/conf/postgresql.conf` | Core database settings — `shared_buffers`, `wal_level`, `max_connections`, and environment-driven tuning knobs                                                             |
| `docker/config/postgres/conf/pg_hba.conf`     | Host-based authentication — enforces `scram-sha-256` for all connections, with entries for local Unix sockets, PgBouncer pooler access, and direct application connections |
| `docker/config/postgres/conf/replica.conf`    | Replica-specific overrides — `hot_standby`, `standby_mode`, and `primary_conninfo` for streaming replication                                                               |

---

## Initialisation Scripts

SQL scripts in `docker/config/postgres/init/` execute in alphabetical order on first container start (when the data volume is empty). All scripts are **idempotent** — re-running them against an existing database is safe.

| Script                    | Purpose                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `01-init-extensions.sql`  | Enables `pgcrypto`, `uuid-ossp`, and `pg_stat_statements` extensions required by the application and monitoring layers         |
| `02-init-schema.sql`      | Creates per-service schemas (`api`, `dashboard`, `pgbouncer`) with strict ownership, isolating tenant data at the schema level |
| `03-init-functions.sql`   | Defines application-level stored procedures and helper functions used across services                                          |
| `04-init-seed.sql`        | Inserts reference data and seed records; the dev overlay mounts additional seed data for local testing                         |
| `05-init-replication.sql` | Creates the replication user, replication slots, and grants required for streaming replication to standby nodes                |

---

## WAL Archival & Streaming Replication

Write-Ahead Log (WAL) archiving is enabled to support Point-in-Time Recovery (PITR). WAL segments are written to a dedicated `postgres_wal` named volume, ensuring they survive container restarts.

In production, two synchronous replicas subscribe to the primary via streaming replication, providing **zero-data-loss failover** capability. The replication topology and user credentials are established by `05-init-replication.sql`.

---

## Connection Pooling via PgBouncer

Applications never connect directly to PostgreSQL in normal operation. All traffic flows through PgBouncer, which runs in **transaction-mode pooling**. This mode releases each backend connection at the end of every transaction, allowing a small pool of PostgreSQL backends to serve a much larger number of concurrent application clients.

PgBouncer authenticates clients with **SCRAM pass-through** backed by `auth_file`: on every stack start, the idempotent `pgbouncer-init` one-shot job copies each connecting user's SCRAM verifier verbatim from `pg_authid` into a runtime-generated `userlist.txt` (held in a Docker volume — no password material in git). Clients authenticate to pgbouncer via SCRAM against that verifier, and pgbouncer forwards SCRAM to the primary using the same keys. `auth_query` is deliberately not used: PgBouncer cannot perform SCRAM pass-through for secrets obtained via `auth_query`.

Rotating a database credential: rotate it in PostgreSQL/Vault as usual, then re-run the `pgbouncer-init` job and reload PgBouncer:

```bash
docker compose --project-directory . \
  -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml \
  run --rm pgbouncer-init
docker kill --signal=HUP infra_pgbouncer    # pick up the regenerated userlist.txt
```

### Exceptions to PgBouncer Routing

| Service   | Reason                                                                                                         | Reference                        |
| --------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| PowerSync | Logical replication requires a continuous, long-lived connection that transaction-mode pooling would terminate | See [powersync.md](powersync.md) |

All application services (API, Dashboard) route their database traffic through PgBouncer per [ADR-019](../architecture/adr/). The former direct-connection exception for the Dashboard ([ADR-013](../architecture/adr/)) is superseded and no longer applies.

---

## Health Check

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-app} -d ${POSTGRES_DB:-app}']
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

`pg_isready` verifies that PostgreSQL is accepting connections without performing a full authentication round-trip, making it suitable for frequent probing.

---

## Resource Allocation

| Environment | CPU Limit | Memory Limit | `shared_buffers` |
| ----------- | --------- | ------------ | ---------------- |
| Dev         | 1 CPU     | 1 GB         | 128 MB           |
| Prod        | 4 CPUs    | 8 GB         | 2 GB             |

The `shared_buffers` parameter is injected via `${POSTGRES_SHARED_BUFFERS}` in the Compose overlay, scaling automatically with the environment's memory budget.

---

## Backup & Recovery

| Operation              | Script                                     | Method       |
| ---------------------- | ------------------------------------------ | ------------ |
| Full backup            | `scripts/backup/backup-postgres.sh`        | `pg_dump`    |
| Restore                | `scripts/restore/restore-postgres.sh`      | `pg_restore` |
| Point-in-time recovery | `scripts/restore/restore-point-in-time.sh` | WAL replay   |

Step-by-step procedures are documented in the [data-operations runbooks](../runbooks/data-operations/backup-postgres.md).

---

## Operational Notes

- **Query monitoring** — The `pg_stat_statements` extension is enabled; data is surfaced in the SigNoz Database dashboard for slow-query identification.
- **Schema-level isolation** — Schemas (`api`, `dashboard`, `pgbouncer`) provide lightweight multi-tenancy without separate databases.
- **Replica config** — Defined in `05-init-replication.sql`; replica containers mount `replica.conf` as their primary configuration.
- **Connection pooling** — PgBouncer in transaction mode is the standard path for all application services (per ADR-019); only PowerSync bypasses it with documented rationale.
