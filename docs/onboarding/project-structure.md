# Project Structure

```
my-project/
├── app/                       # Application workspaces (Bun + pnpm)
│   ├── api/                   #   Hono REST API
│   │   └── Dockerfile         #     Built from repo-root context
│   ├── dashboard/             #   TanStack Start dashboard
│   │   └── Dockerfile         #     Built from repo-root context
│   └── marketing/             #   Astro landing page
│       └── Dockerfile         #     Built from repo-root context
├── docker/                    # All Docker-related assets (consolidated)
│   ├── config/              #   Per-service configuration files
│   │   ├── postgres/        #     init scripts, WAL config, pg_hba, replica.conf
│   │   ├── redis/           #     redis.conf, sentinel.conf, users.acl
│   │   ├── clickhouse/      #     config.xml, TTL init SQL
│   │   ├── caddy/           #     Caddyfile, snippets (security, rate-limiting, upstreams)
│   │   ├── cloudflared/     #     Tunnel ingress config
│   │   ├── minio/           #     Bucket policies (readonly, upload, app)
│   │   ├── opentelemetry/   #     Collector config + pipelines (metrics, traces, logs)
│   │   ├── pgbouncer/       #     pgbouncer.ini, userlist.txt, init script
│   │   ├── powersync/       #     Sync rules, entrypoint
│   │   ├── keepalived/      #     VRRP config + template
│   │   ├── signoz/          #     Dashboards, alert rules, app config
│   │   └── vault/           #     Vault config, policies (HCL), init/unseal/secrets scripts
│   ├── dockerfiles/         #   Infra image Dockerfiles
│   │   ├── caddy/Dockerfile #     Caddy 2.8.4-alpine, custom entrypoint
│   │   ├── redis/Dockerfile #     Redis 7.4-alpine, multi-role (primary/replica/sentinel)
│   │   └── postgres-replica/Dockerfile # PostgreSQL 17-alpine, replica setup
│   └── tests/               #   Integration and security tests
│       ├── integration/     #     End-to-end tests across services
│       └── security/        #     CIS benchmark, nmap scans, tunnel access
│   ├── compose/             #   Modular Docker Compose files (ADR-003, ADR-024)
│   │   ├── networks.yml         #   Network definitions (edge, backend, infrastructure)
│   │   ├── volumes.yml          #   Named volume declarations
│   │   ├── base.yml             #   Core infrastructure services (all environments)
│   │   ├── app.yml              #   Application services (api, dashboard, marketing)
│   │   ├── observability.yml    #   ClickHouse, OTEL Collector, SigNoz frontend
│   │   ├── edge.yml             #   Caddy active/standby, Cloudflared
│   │   ├── scaling.yml          #   Redis replicas, PG replicas, Sentinels
│   │   ├── security.yml         #   Vault, MinIO backup (Staging + Prod)
│   │   └── profiles/            #   Environment-specific overrides
│   │       ├── dev.override.yml     # Dev: infra only, published ports, low resources
│   │       ├── staging.override.yml # Staging: infra+app+observability, moderate resources
│   │       └── prod.override.yml    # Prod: full stack, HA, no published ports, high resources
├── scripts/
│   ├── backup/              #   pg_dump, S3 snapshot, ClickHouse backup
│   ├── deploy/              #   Rolling deploy, zero-downtime swap
│   ├── init/                #   First-run DB migration, seeding, MinIO buckets
│   ├── security/            #   TLS cert renewal, Vault unseal, audit
│   ├── monitoring/          #   Health checks, metric exporters, alerts
│   ├── maintenance/         #   Log rotation, volume cleanup, vacuums
│   └── restore/             #   Point-in-time DB restore, S3 restore
├── data/                    # Persistent data (gitignored)
│   ├── postgres/            #   PostgreSQL data directory
│   ├── redis/               #   Redis RDB/AOF files
│   ├── minio/               #   Object storage data
│   ├── clickhouse/          #   ClickHouse data and metadata
│   ├── vault/               #   Vault storage backend
│   └── backups/             #   Scheduled backup output
├── docs/
│   ├── onboarding/          #   Getting started guides
│   ├── architecture/        #   System design, ADRs
│   ├── services/            #   Per-service documentation
│   ├── configuration/       #   How to customize the stack
│   ├── runbooks/            #   Operational procedures
│   └── development/         #   Contributor guide
├── .github/
│   └── workflows/           #   CI/CD pipelines (lint, test, scan, deploy)
├── .env                     # Environment variables (dev uses directly; staging/prod use Vault)
├── justfile                 # Central CLI — all recipes live here
```

## Key Patterns

- **Modular Compose**: The `docker/compose/` directory contains 11 purpose-split YAML files that are assembled per environment using Docker Compose's multi-file strategy. Base modules define services without ports or resource limits; `profiles/*.override.yml` files add ports, resources, and environment-specific configuration. The old monolithic `docker-compose.yml` / `docker-compose.dev.yml` / `docker-compose.prod.yml` trio has been removed in favor of this modular structure.

- **Three-environment tiering**:
  - **Dev** (5 services): `networks.yml` + `volumes.yml` + `base.yml` + `dev.override.yml` — databases, caches, storage, sync engine only. No application or observability services.
  - **Staging** (20 services): base + `app.yml` + `observability.yml` + `security.yml` + `staging.override.yml` — adds ClickHouse, the monitoring stack, application services, and the Vault + MinIO-backup security layer. Single instances, moderate resources.
  - **Prod** (31 services): base + app + observability + `edge.yml` + `scaling.yml` + `security.yml` + `prod.override.yml` — full HA stack with Vault, replicas, Keepalived, and Cloudflare Tunnel.

- **Just as CLI**: Every operational command (build, deploy, backup, scan) is a `just` recipe. Run `just --list` for the full index. Recipes use `DEV_COMPOSE`, `STAGING_COMPOSE`, and `PROD_COMPOSE` variables to select the right file combination for each environment.

- **Tiered secrets (ADR-006)**: Development uses `.env` environment variables directly — no Docker secrets, no Vault required. Staging and production use HashiCorp Vault for dynamic, time-limited credentials. Docker secrets have been removed entirely; sensitive values reach containers as environment variables in every environment.

- **Consolidated docker/ directory**: All Docker-related assets for infrastructure — configuration files, infra Dockerfiles, and test suites — live under `docker/` rather than scattered as top-level directories. Compose files reference these via `./docker/config/`, `./docker/dockerfiles/`, and `./docker/tests/`. Application images are the exception: each app ships its own `Dockerfile` co-located at `app/<name>/Dockerfile`, built with the repo root as the build context.

- **Network isolation**: Three networks enforce separation — `edge` (172.20.0.0/24) for ingress, `backend` (172.21.0.0/24) for application services, and `infrastructure` (172.22.0.0/24) as an internal-only network for databases and Vault.
