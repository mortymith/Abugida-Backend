# PowerSync

> **Real-time, offline-first data synchronisation** between PostgreSQL and client applications via PostgreSQL's logical replication protocol.

---

## Overview

| Property           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| **Image**          | `journeyapps/powersync-service:1.24`                      |
| **Container Port** | 8085 (client API + probes), 9090 (Prometheus metrics)     |
| **Dev Host Port**  | 8085 (API), 9090/9091 (metrics)                           |
| **Network**        | `infrastructure`                                          |
| **Services**       | `powersync-sync` (singleton), `powersync-api` (stateless) |
| **Environments**   | All                                                       |

Design decisions live in [ADR-025](../architecture/adr/ADR-025-powersync-postgres-storage.md).

---

## Service Topology

| Service           | Command         | Role                                                                                                                          |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `powersync-sync`  | `start -r sync` | Replication worker. **SINGLETON** — owns the logical replication slot against `postgres-primary`. Never scale.                |
| `powersync-api`   | `start -r api`  | Client-facing sync API. Stateless — scale freely behind Caddy (`DOMAIN_SYNC`).                                                |
| `powersync-setup` | one-shot job    | Idempotent DB provisioning. Runs automatically before `powersync-sync`/`powersync-api`; re-run manually with `just ps-setup`. |

Both runtime roles read `/config/service.yaml` + `/config/sync-config.yaml`.

---

## Configuration Files

| File                                                | Purpose                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `docker/config/powersync/service.yaml`              | Service config: replication/storage connections, client auth, telemetry   |
| `docker/config/powersync/sync-config.yaml`          | Sync Streams (`config.edition: 3`) defining which tables/rows clients get |
| `docker/init/init-powersync.sh`                     | One-shot setup script: roles, grants, publication, storage grant          |
| `docker/config/postgres/init/06-init-powersync.sql` | Fresh-volume baseline mirroring the setup script                          |

Config env-var substitution uses YAML `!env PS_...` tags — only `PS_`-prefixed
variables are substituted, and every referenced variable must be listed under
each service's `environment:` in `docker/compose/base.yml`.

---

## Source Database Requirements

1. **Publication named exactly `powersync`** (`CREATE PUBLICATION powersync FOR ALL TABLES;`) — without it, replication never starts.
2. **Replication role** `powersync`: REPLICATION BYPASSRLS + SELECT on tables.
3. **Storage role** `powersync_storage`: LOGIN + CREATE on database only; PowerSync creates and migrates its own `powersync` schema under it. Do not hand-create tables there.

All three are applied idempotently by the `powersync-setup` one-shot job, which
runs automatically on every stack start (before the sync/api roles) and can
also be triggered manually:

```bash
just ps-setup                # dev file set
just ps-setup staging        # or prod
```

The job is safe on fresh and existing volumes and re-syncs role passwords on
rotation. On fresh volumes this is essential: init SQL creates both roles
without passwords, and PowerSync cannot authenticate until the job applies
them from `PS_REPLICATION_PASSWORD` / `PS_STORAGE_PASSWORD`. `pg_hba.conf`
carries dedicated entries for both roles (replication and regular connections).

---

## Direct PostgreSQL Connection

PowerSync connects **directly** to `postgres-primary:5432`, bypassing PgBouncer. This is a hard requirement — PgBouncer's transaction-mode pooling terminates and re-establishes connections at transaction boundaries, which would break the continuous logical replication stream that PowerSync depends on.

PowerSync is the only service permitted to open direct connections to PostgreSQL; all application services (API, Dashboard) connect via PgBouncer per ADR-019. The guardrail is enforced by `scripts/security/check-configs.sh`.

---

## Sync Streams

Streams in `sync-config.yaml` determine which tables and rows are replicated to client devices (Sync Streams format, `config.edition: 3`). The shipped streams are **placeholders** — `auto_subscribe: false`, so nothing syncs until replaced and clients subscribe.

Rules of thumb:

- Parameterise per-user data with `auth.user_id()` (cast when comparing to bigint PKs)
- Respect soft deletes (`deleted_at IS NULL`)
- Follow https://docs.powersync.com/maintenance-ops/deploying-schema-changes for rule rollouts

---

## Client Authentication

Client SDKs present JWTs validated against Better Auth's JWKS endpoint:

| Setting                | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `PS_JWKS_URI`          | `<api-base>/api/auth/jwks`                                         |
| `client_auth.audience` | `abugida`                                                          |
| Token source           | `@abugida/auth` `tokens` config (better-auth jwt + bearer plugins) |
| Token subject          | user id → readable in streams as `auth.user_id()`                  |

Enabling tokens requires the better-auth-generated `jwks` table in the consumer's Drizzle schema.

---

## WAL Bloat Risk

Logical replication slots retain WAL segments until consumed. If PowerSync stops consuming (service down or overwhelmed), WAL accumulates on the primary and can fill the disk. This is the **single most important operational risk** associated with PowerSync.

PowerSync owns its slot (auto-generated name); no manual slots exist. If the service will be down for an extended period, drop the slot to allow WAL recycling and let PowerSync re-create it on resume (full re-sync follows).

### Monitoring & Mitigation

| Action         | How                                                                            |
| -------------- | ------------------------------------------------------------------------------ |
| Check slot lag | `just ps-slot-lag`                                                             |
| Metrics        | Prometheus scrape of `powersync-api:9090` by the OTEL collector (staging/prod) |
| Set up alerts  | SigNoz alerts for WAL directory growth and slot lag                            |

---

## Bucket Compaction

Storage buckets grow as an append-only operation log and need periodic compaction — the self-hosted service does not schedule this itself.

```bash
just ps-compact
# Prod cron example:
# 0 3 * * * cd /srv/abugida && just ps-compact >>/var/log/powersync-compact.log 2>&1
```

---

## Resource Allocation

Per role (sync + api each):

| Environment | CPU Limit | Memory Limit |
| ----------- | --------- | ------------ |
| Dev         | 0.5 CPU   | 512 MB       |
| Staging     | 0.5 CPU   | 1 GB         |
| Prod        | 1 CPU     | 1 GB         |

---

## Health Checks

Both services probe `GET /probes/liveness` (also available: `/probes/startup`):

```yaml
healthcheck:
  test:
    [
      'CMD',
      'node',
      '-e',
      "fetch('http://localhost:8085/probes/liveness').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
    ]
  interval: 15s
  timeout: 5s
  retries: 10
  start_period: 30s
```

Depends on `postgres-primary` with `condition: service_healthy` — will not start until PostgreSQL is accepting connections.

---

## Port Exposure

| Environment | Port Mapping             | Access                                                   |
| ----------- | ------------------------ | -------------------------------------------------------- |
| Dev         | `8085:8085`, `9090/9091` | Published to host for client SDK testing                 |
| Staging     | `8085:8085`              | Published for debugging                                  |
| Prod        | None                     | Internal only; clients connect via Caddy (`DOMAIN_SYNC`) |

Caddy proxies with `flush_interval -1` so long-lived sync streams are not buffered.

---

## Just Recipes

| Recipe                | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `just ps-status`      | API liveness + logical replication slot overview |
| `just ps-slot-lag`    | Detailed slot lag / flush lag                    |
| `just ps-logs <svc>`  | Tail logs (`api`, `sync`, `setup`)               |
| `just ps-restart`     | Restart both roles                               |
| `just ps-setup [env]` | Run the idempotent DB provisioning job           |
| `just ps-compact`     | Run bucket compaction now                        |
