# Environment Variables Reference

Master reference for all variables in `.env`. Create yours with `cp .env.example .env`, then replace every value marked **REQUIRED** (secrets ship as `change-me` placeholders).

> **Secrets management is environment-specific.** Development uses `.env` variables directly (no Docker secrets, no Vault). Staging and production use HashiCorp Vault for dynamic credentials (ADR-006). The variables below include non-sensitive operational parameters and development secret placeholders. Never commit real production secrets to `.env`.

## Identity

| Variable               | Default       | Description                                                                   |
| ---------------------- | ------------- | ----------------------------------------------------------------------------- |
| `ENVIRONMENT`          | `development` | Environment label passed to all services (development / staging / production) |
| `COMPOSE_PROJECT_NAME` | `infra`       | Docker Compose project prefix for containers, volumes, and networks           |

## Domain Configuration

| Variable               | Default               | Description                                                         |
| ---------------------- | --------------------- | ------------------------------------------------------------------- |
| `DOMAIN_API`           | `localhost`           | API virtual host (dev: `api.localhost`, prod: `api.yourdomain.com`) |
| `DOMAIN_DASHBOARD`     | `localhost`           | Dashboard virtual host                                              |
| `DOMAIN_MARKETING`     | `marketing.localhost` | Marketing site virtual host                                         |
| `DOMAIN_SYNC`          | `sync.localhost`      | PowerSync client sync host                                          |
| `DOMAIN_SIGNOZ`        | `localhost.localhost` | SigNoz UI virtual host (prod only, via Cloudflare Tunnel)           |
| `DOMAIN_MINIO_CONSOLE` | `localhost`           | MinIO Console virtual host (dev/staging only)                       |
| `CADDY_EMAIL`          | `admin@example.com`   | ACME certificate notification email                                 |
| `CADDY_ACME_ISSUER`    | `letsencrypt`         | Caddy certificate issuer: `letsencrypt` / `zerossl` / `local`       |

All domain/email variables are injected into the Caddy containers (`edge.yml`) and consumed by the Caddyfile via `{$VAR}` interpolation.

## Secrets (Dev Only)

These variables provide credentials in development via `.env`. In `.env.example` they ship as `change-me` placeholders — **replace every one before first boot** (passwords are baked into storage on first volume init; Redis ACL values are re-applied at each container start). In staging and production they are replaced by Vault dynamic credentials — the `.env` values are ignored.

### Rotation semantics

| Credential                                                  | Applied                                                                              | Rotating after first boot                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `PS_*_PASSWORD` | First volume init only (`PS_*` also on every `just ps-setup`)                        | Requires `just dev-clean` (destroys local data) or manual SQL/mc rotation                                                       |
| Database credentials for PgBouncer users                    | `pgbouncer-init` re-syncs verifiers into the pooler's auth file on every stack start | Rotate in PostgreSQL, then restart the stack (or re-run `pgbouncer-init` + SIGHUP — see [postgres.md](../services/postgres.md)) |
| `REDIS_*_PASSWORD`                                          | Every container start (entrypoint regenerates the ACL file)                          | Edit `.env`, then restart Redis containers                                                                                      |

| Variable                  | Default              | Description                                                              |
| ------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`       | _(set during setup)_ | PostgreSQL password for app user                                         |
| `REDIS_PASSWORD`          | _(set during setup)_ | Redis app user password                                                  |
| `PGBOUNCER_AUTH_USERS`    | `$POSTGRES_USER`     | Extra roles exposed through the pooler (comma-separated)                 |
| `REDIS_ADMIN_PASSWORD`    | _(set during setup)_ | Redis admin user password                                                |
| `REDIS_READONLY_PASSWORD` | _(set during setup)_ | Redis readonly user password                                             |
| `REDIS_SENTINEL_PASSWORD` | _(set during setup)_ | Redis Sentinel auth password                                             |
| `MINIO_ROOT_PASSWORD`     | _(set during setup)_ | MinIO root user password                                                 |
| `API_SECRET_KEY`          | _(set during setup)_ | API signing key for JWT/auth                                             |
| `PS_REPLICATION_PASSWORD` | _(set during setup)_ | PowerSync replication role password                                      |
| `PS_STORAGE_PASSWORD`     | _(set during setup)_ | PowerSync bucket-storage role password                                   |
| `PS_JWKS_URI`             | _(set during setup)_ | JWKS endpoint validating client sync JWTs (Better Auth `/api/auth/jwks`) |

## Exposed Ports (Dev and Staging Only)

Port overrides publish container ports to the host in dev and staging. Production removes all published ports (`ports: []`).

| Variable                      | Default | Description                                              |
| ----------------------------- | ------- | -------------------------------------------------------- |
| `API_PORT`                    | `3001`  | Host port for API (container port 3000)                  |
| `DASHBOARD_PORT`              | `8081`  | Host port for Dashboard (container port 8080)            |
| `MARKETING_PORT`              | `8082`  | Host port for Marketing site (container port 8080)       |
| `REDIS_PORT`                  | `6379`  | Host port for Redis primary                              |
| `POSTGRES_PORT`               | `5432`  | Host port for PostgreSQL primary                         |
| `PGBOUNCER_PORT`              | `6432`  | Host port for PgBouncer                                  |
| `MINIO_API_PORT`              | `9000`  | Host port for MinIO S3 API                               |
| `MINIO_CONSOLE_PORT`          | `9001`  | Host port for MinIO Console                              |
| `SIGNOZ_FRONTEND_PORT`        | `3002`  | Host port for SigNoz UI                                  |
| `OTEL_GRPC_PORT`              | `4317`  | Host port for OTLP gRPC                                  |
| `OTEL_HTTP_PORT`              | `4318`  | Host port for OTLP HTTP                                  |
| `CLICKHOUSE_HTTP_PORT`        | `8123`  | Host port for ClickHouse HTTP (staging only)             |
| `VAULT_API_PORT`              | `8200`  | Host port for Vault API (staging only)                   |
| `POWERSYNC_PORT`              | `8085`  | Host port for PowerSync sync API                         |
| `POWERSYNC_METRICS_PORT`      | `9090`  | Host port for PowerSync API Prometheus metrics (dev)     |
| `POWERSYNC_SYNC_METRICS_PORT` | `9091`  | Host port for PowerSync replication-worker metrics (dev) |

## Replica Counts

Production-tier replica counts. Dev and staging always run single instances.

| Variable             | Default | Description                          |
| -------------------- | ------- | ------------------------------------ |
| `API_REPLICAS`       | `1`     | API replicas (prod commonly 3)       |
| `DASHBOARD_REPLICAS` | `1`     | Dashboard replicas (prod commonly 3) |
| `MARKETING_REPLICAS` | `1`     | Marketing replicas (prod commonly 3) |

Redis replicas/sentinels are statically defined in `scaling.yml` (2 replicas + 3 sentinels in prod); they are not configurable by count.

## Resource Limits

Per-container CPU and memory caps. Values use Docker Compose `deploy.resources.limits` format. Override files scale these per environment: dev (1 CPU / 1GB), staging (2 CPU / 2GB), prod (4 CPU / 8GB with reservations).

| Variable                                          | Default         | Description                             |
| ------------------------------------------------- | --------------- | --------------------------------------- |
| `API_CPU_LIMIT` / `API_MEM_LIMIT`                 | `1` / `1g`      | API container resources                 |
| `DASHBOARD_CPU_LIMIT` / `DASHBOARD_MEM_LIMIT`     | `1` / `1g`      | Dashboard container resources           |
| `MARKETING_CPU_LIMIT` / `MARKETING_MEM_LIMIT`     | `0.5` / `512m`  | Marketing container resources           |
| `REDIS_CPU_LIMIT` / `REDIS_MEM_LIMIT`             | `0.5` / `512m`  | Redis primary + replicas resources      |
| `SENTINEL_CPU_LIMIT` / `SENTINEL_MEM_LIMIT`       | `0.5` / `256m`  | Redis Sentinel resources                |
| `POSTGRES_CPU_LIMIT` / `POSTGRES_MEM_LIMIT`       | `1` / `1g`      | PostgreSQL primary + replicas resources |
| `PGBOUNCER_CPU_LIMIT` / `PGBOUNCER_MEM_LIMIT`     | `0.5` / `256m`  | PgBouncer resources                     |
| `MINIO_CPU_LIMIT` / `MINIO_MEM_LIMIT`             | `1` / `1g`      | MinIO (+ backup target) resources       |
| `VAULT_CPU_LIMIT` / `VAULT_MEM_LIMIT`             | `0.5` / `512m`  | Vault resources                         |
| `SIGNOZ_CPU_LIMIT` / `SIGNOZ_MEM_LIMIT`           | `1` / `2g`      | SigNoz resources                        |
| `OTEL_CPU_LIMIT` / `OTEL_MEM_LIMIT`               | `0.5` / `512m`  | OTel Collector resources                |
| `CLICKHOUSE_CPU_LIMIT` / `CLICKHOUSE_MEM_LIMIT`   | `1` / `1g`      | ClickHouse resources                    |
| `POWERSYNC_CPU_LIMIT` / `POWERSYNC_MEM_LIMIT`     | `0.5` / `512m`  | PowerSync resources                     |
| `CADDY_CPU_LIMIT` / `CADDY_MEM_LIMIT`             | `2` / `1g`      | Caddy (active + standby) resources      |
| `KEEPALIVED_CPU_LIMIT` / `KEEPALIVED_MEM_LIMIT`   | `0.25` / `128m` | Keepalived VIP manager resources        |
| `CLOUDFLARED_CPU_LIMIT` / `CLOUDFLARED_MEM_LIMIT` | `0.5` / `256m`  | Cloudflare Tunnel connector resources   |

## Database / Redis / MinIO

| Variable                      | Default            | Description                                              |
| ----------------------------- | ------------------ | -------------------------------------------------------- |
| `POSTGRES_DB`                 | `app`              | Default database name                                    |
| `POSTGRES_USER`               | `app`              | Application database user                                |
| `POSTGRES_SHARED_BUFFERS`     | `128MB`            | PostgreSQL shared buffers (staging: 256MB, prod: 2GB)    |
| `POSTGRES_PRIMARY_HOST`       | `postgres-primary` | Primary hostname as seen by prod replicas                |
| `REPLICA1_SLOT_NAME`          | `replica_slot_1`   | Physical replication slot for postgres-replica-1         |
| `REPLICA2_SLOT_NAME`          | `replica_slot_2`   | Physical replication slot for postgres-replica-2         |
| `PGBOUNCER_MAX_CLIENT_CONN`   | `100`              | Max client connections                                   |
| `PGBOUNCER_DEFAULT_POOL_SIZE` | `20`               | Default pool size                                        |
| `PGBOUNCER_MIN_POOL_SIZE`     | `5`                | Minimum pool size                                        |
| `REDIS_MAXMEMORY`             | `512mb`            | Max memory limit (applied by entrypoint over redis.conf) |
| `REDIS_MAXMEMORY_POLICY`      | `allkeys-lru`      | Eviction policy                                          |
| `REDIS_SENTINEL_QUORUM`       | `2`                | Sentinel failover quorum (`init-redis.sh`)               |
| `REDIS_TLS_ENABLED`           | `0`                | Enable Redis TLS listener (`1` requires certs mounted)   |
| `REDIS_MIN_REPLICAS`          | `0`                | Min healthy replicas before primary accepts writes       |
| `REDIS_MIN_REPLICAS_MAX_LAG`  | `10`               | Max replica lag (seconds) paired with the above          |
| `MINIO_ROOT_USER`             | `minioadmin`       | MinIO root access key (non-sensitive)                    |
| `MINIO_BUCKET_NAME`           | `app-data`         | Default bucket name                                      |

## ClickHouse (staging/prod)

Single `default` user; the password is applied by the image entrypoint.
REQUIRED [secret] in staging/prod (openssl rand hex 32); consumed by
`observability.yml`.

| Variable              | Default   | Description                               |
| --------------------- | --------- | ----------------------------------------- |
| `CLICKHOUSE_USER`     | `default` | ClickHouse username                       |
| `CLICKHOUSE_PASSWORD` | _(empty)_ | REQUIRED [secret] — default user password |

## SigNoz (staging/prod)

REQUIRED [secret] in staging/prod (openssl rand hex 32 for both).

| Variable             | Default   | Description                                                   |
| -------------------- | --------- | ------------------------------------------------------------- |
| `SIGNOZ_DB_PASSWORD` | _(empty)_ | Metadata-store role password (provisioned by signoz-db-setup) |
| `SIGNOZ_JWT_SECRET`  | _(empty)_ | SigNoz UI session/token signing secret                        |

## Vault Bootstrap

| Variable            | Default | Description                                           |
| ------------------- | ------- | ----------------------------------------------------- |
| `VAULT_SKIP_VERIFY` | `0`     | `1` skips Vault TLS verification (local testing only) |

## PowerSync Runtime

| Variable                 | Default                    | Description                                    |
| ------------------------ | -------------------------- | ---------------------------------------------- |
| `POWERSYNC_NODE_OPTIONS` | `--max-old-space-size=384` | Node heap hint (staging/prod overrides to 768) |

## Observability

| Variable                        | Default      | Description                                                           |
| ------------------------------- | ------------ | --------------------------------------------------------------------- |
| `SIGNOZ_METRICS_RETENTION_DAYS` | `7`          | ClickHouse TTL for metrics                                            |
| `SIGNOZ_TRACES_RETENTION_DAYS`  | `7`          | ClickHouse TTL for traces                                             |
| `SIGNOZ_LOGS_RETENTION_DAYS`    | `7`          | ClickHouse TTL for logs                                               |
| `PGBOUNCER_AUTH_USERS`          | `app,signoz` | Roles exposed through the pooler (verifiers synced by pgbouncer-init) |

## Cloudflare Tunnel

| Variable                  | Default   | Description                                   |
| ------------------------- | --------- | --------------------------------------------- |
| `CLOUDFLARE_TUNNEL_TOKEN` | _(empty)_ | Tunnel authentication token (production only) |
| `CLOUDFLARE_TUNNEL_NAME`  | _(empty)_ | Tunnel name in Cloudflare dashboard           |

## Telegram Alerting

| Variable             | Default   | Description                                |
| -------------------- | --------- | ------------------------------------------ |
| `TELEGRAM_BOT_TOKEN` | _(empty)_ | Telegram bot token for alert notifications |
| `TELEGRAM_CHAT_ID`   | _(empty)_ | Telegram chat ID to receive alerts         |

## Backup & S3

| Variable                | Default                  | Description                           |
| ----------------------- | ------------------------ | ------------------------------------- |
| `BACKUP_S3_BUCKET`      | `infrastructure-backups` | S3 bucket for backup storage          |
| `BACKUP_S3_PREFIX`      | _(empty)_                | S3 key prefix for backup objects      |
| `AWS_REGION`            | `us-east-1`              | AWS region for backup target          |
| `AWS_ACCESS_KEY_ID`     | _(empty)_                | S3-compatible access key              |
| `AWS_SECRET_ACCESS_KEY` | _(empty)_                | S3-compatible secret key              |
| `BACKUP_RETENTION_DAYS` | `30`                     | Days to retain backups before cleanup |

## Deployment

| Variable          | Default    | Description                                     |
| ----------------- | ---------- | ----------------------------------------------- |
| `DEPLOY_STRATEGY` | `recreate` | Deployment strategy: `recreate` or `blue-green` |
| `DEPLOY_VERSION`  | _(empty)_  | Version tag injected at deploy time             |
| `LOG_LEVEL`       | `debug`    | Application log verbosity                       |
| `DEBUG_MODE`      | `true`     | Enable debug endpoints (staging/prod: `false`)  |
