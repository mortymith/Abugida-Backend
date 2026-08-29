# ADR-025: PowerSync with Postgres Storage, Split Roles, and Sync Streams

## Status

Accepted

## Context

PowerSync provides offline-first client sync via Postgres logical replication.
The initial deployment wired a single `power-sync` container whose service
config predated the current PowerSync schema: it had no `replication:` or
`storage:` sections, no source-database publication, an incorrect health
endpoint (`/health`), and relied on an entrypoint script exporting a
`DATABASE_URL` variable the official image does not consume. In practice the
service could not start replication at all.

The verified reference deployment (`example/powersync-pg17/`, checked against
docs.powersync.com) establishes the correct shape: PostgreSQL as both source
and bucket storage (no MongoDB), a publication named exactly `powersync`,
least-privilege roles, split `sync`/`api` processes, `/probes/*` health
endpoints, Prometheus metrics, and Sync Streams (`edition: 3`) for data
partitioning.

## Decision

1. **Postgres is PowerSync's bucket storage** — same server as the source DB,
   separate roles/schemas. No MongoDB dependency is introduced.
2. **Two least-privilege roles**, not one shared user:
   - `powersync` — REPLICATION BYPASSRLS, SELECT on tables (source reads)
   - `powersync_storage` — LOGIN + CREATE on database only (bucket storage;
     PowerSync owns and migrates its own `powersync` schema)
     Role passwords come from `PS_REPLICATION_PASSWORD` / `PS_STORAGE_PASSWORD`
     per the secret layering in ADR-006.
3. **Split process roles**: `powersync-sync` runs `-r sync` as a singleton
   (it owns the logical replication slot); `powersync-api` runs `-r api` and
   is stateless/scalable behind Caddy (`DOMAIN_SYNC`).
4. **Direct connection preserved**: both roles connect directly to
   `postgres-primary:5432`, bypassing PgBouncer (per docs/services/powersync.md;
   enforced by scripts/security/check-configs.sh). This deliberately deviates
   from the reference example, which pools replication through PgBouncer.
5. **Sync Streams** (`config.edition: 3`) replace legacy sync-rules syntax in
   `docker/config/powersync/sync-config.yaml`. Placeholder streams ship
   disabled (`auto_subscribe: false`) until real streams are defined.
6. **Idempotent setup job**: a one-shot `powersync-setup` compose service
   applies roles/grants/publication on fresh AND existing volumes. It runs
   automatically on every stack start (before `powersync-sync`/`powersync-api`,
   same lifecycle as `pgbouncer-init`) and can be re-run via `just ps-setup`.
   Init-time SQL under
   `docker/config/postgres/init/06-init-powersync.sql` mirrors it for fresh
   installs only.
7. **No pre-created replication slot**: PowerSync creates and owns its slot.
   A manually created slot it does not consume would retain WAL indefinitely.
8. **Client auth via Better Auth JWKS**: `@abugida/auth` gains opt-in
   `tokens` config enabling better-auth's jwt + bearer plugins. PowerSync's
   `client_auth.jwks_uri` points at `<api>/api/auth/jwks`; audience is fixed
   as `abugida`.

## Consequences

### Positive

- Replication actually starts: valid config schema, required publication,
  correct probe endpoints.
- Blast radius shrinks: two scoped roles instead of a shared credential;
  storage writes can never read application tables.
- API tier scales independently of the singleton replicator.
- Metrics (`:9090`) flow into SigNoz, enabling slot-lag/WAL-growth alerting.

### Negative

- Bucket storage shares the Postgres server's disk I/O with production data;
  compaction must be scheduled manually (`just ps-compact`, cron in prod).
- Publication is `FOR ALL TABLES`: ops tables are published to the slot.
  Streams gate what clients actually receive; switch to an explicit table
  list if a tighter blast radius is ever required.
- Enabling the jwt plugin requires consumers to add better-auth's `jwks`
  table to their Drizzle schema.

## References

- Reference deployment: `example/powersync-pg17/`
- Service docs: `docs/services/powersync.md`
- Config schema: https://unpkg.com/@powersync/service-schema@latest/json-schema/powersync-config.json
