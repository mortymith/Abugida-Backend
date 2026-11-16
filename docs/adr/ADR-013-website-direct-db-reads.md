# ADR-013: Website direct database reads

## Status

**Superseded by ADR-019**

## Context

The Website (front-end) service needed to serve read-heavy pages and was originally allowed to open its own connections to `postgres-primary:5432`, bypassing PgBouncer, on the theory that read queries wanted the shortest path and did not need pooling.

That shortcut was attractive at the time — one fewer hop for reads — but it conflicted with the rest of the platform:

- It duplicated database credentials and connection logic outside the pooling layer.
- It made connection accounting and `max_connections` sizing harder, because one service's connections were invisible to PgBouncer.
- It created a second code path for database access that had to be kept in step with the pooled path.

## Decision

~~The Website connects directly to `postgres-primary:5432` for its read queries, bypassing PgBouncer.~~

**Superseded.** All application services — including the Website/Dashboard — now connect **through PgBouncer** (`pgbouncer:6432`) in transaction-mode pooling (ADR-019). There is a single database-access path for application code.

The only remaining direct connection to `postgres-primary:5432` is PowerSync's logical-replication connection, which cannot tolerate transaction-mode pooling; that exception is deliberate and documented (ADR-025, `docs/services/powersync.md`), and enforced by `scripts/security/check-configs.sh`.

## Consequences

### Positive (as superseded)

- Consistent connection accounting: every application connection passes through PgBouncer, so pool sizing and `max_connections` are predictable.
- One credential and one access path for application code.
- Pooling absorbs the connection churn of many replicas and frequent restarts.

### Negative (as superseded)

- Reads take one extra hop through PgBouncer. In practice this is negligible relative to query time and is outweighed by the connection savings.
- Services must be PgBouncer-aware (e.g. avoiding session-level features that transaction pooling does not preserve). This is already required of API and Dashboard.

### Migration

- Direct `postgres-primary:5432` connections and their credentials were removed from application configuration.
- Application DSNs point at `pgbouncer:6432`.
- Post-deploy verification checks that application services resolve to PgBouncer, not the primary.

## References

- Connection pooling: ADR-019 · PowerSync direct-connection exception: ADR-025
- Networking (supersession note): `docs/architecture/networking.md`
- PostgreSQL service: `docs/services/postgres.md`
- Enforced by: `scripts/security/check-configs.sh`
