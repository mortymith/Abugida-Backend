# Compose Overlays

This project uses Docker Compose's multi-file merge strategy with a **12-file modular structure** in the `docker/compose/` directory. Instead of monolithic overlay files, services are split by concern and assembled per environment. Base modules define services without ports or resource limits; environment-specific overrides in `profiles/*.override.yml` add those.

## File Structure

```
docker/compose/
├── networks.yml              # Network definitions (edge, backend, infrastructure)
├── volumes.yml               # Named volume declarations
├── base.yml                  # Core infrastructure (all environments)
├── app.yml                   # Application services (staging, prod)
├── observability.yml         # ClickHouse, OTEL Collector, SigNoz (staging, prod)
├── edge.yml                  # Caddy HA, Cloudflared (prod)
├── scaling.yml               # Replicas, Sentinels (prod)
├── security.yml              # Vault, MinIO backup (Staging + Prod)
└── profiles/
    ├── dev.override.yml      # Dev ports + resources
    ├── staging.override.yml  # Staging ports + resources
    └── prod.override.yml     # Prod resources (no ports)
```

## How Assembly Works

Docker Compose merges files left-to-right. Later files override earlier ones for the same key. The three tiers assemble different subsets of modules:

```bash
# Development (5 services)
DEV_COMPOSE="docker compose \
  -f docker/compose/networks.yml \
  -f docker/compose/volumes.yml \
  -f docker/compose/base.yml \
  -f docker/compose/profiles/dev.override.yml"

# Staging (20 services)
STAGING_COMPOSE="docker compose \
  -f docker/compose/networks.yml \
  -f docker/compose/volumes.yml \
  -f docker/compose/base.yml \
  -f docker/compose/app.yml \
  -f docker/compose/observability.yml \
  -f docker/compose/security.yml \
  -f docker/compose/profiles/staging.override.yml"

# Production (31 services)
PROD_COMPOSE="docker compose \
  -f docker/compose/networks.yml \
  -f docker/compose/volumes.yml \
  -f docker/compose/base.yml \
  -f docker/compose/app.yml \
  -f docker/compose/observability.yml \
  -f docker/compose/edge.yml \
  -f docker/compose/scaling.yml \
  -f docker/compose/security.yml \
  -f docker/compose/profiles/prod.override.yml"
```

The Just aliases `DEV_COMPOSE`, `STAGING_COMPOSE`, and `PROD_COMPOSE` wrap these commands:

```bash
just dev        # equivalent to DEV_COMPOSE up -d
just staging    # equivalent to STAGING_COMPOSE up -d
just deploy prod # equivalent to PROD_COMPOSE with deploy script
```

## Module Responsibilities

### Shared Infrastructure

| File           | What It Defines                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `networks.yml` | `edge` (172.20.0.0/24), `backend` (172.21.0.0/24), `infrastructure` (172.22.0.0/24, internal) with IPAM subnets                                   |
| `volumes.yml`  | Named volumes shared across environments: `postgres_data`, `redis_primary_data`, `minio_data`, `caddy_data`, `caddy-config`, `postgres_wal`, etc. |

Tier-specific volumes live with their services: `clickhouse_data` in `observability.yml`, production-only volumes in `profiles/prod.override.yml`.

### Base Services (`base.yml`)

Defines core infrastructure that runs in **all** environments:

- **Services**: postgres-primary, pgbouncer, redis-primary, minio, powersync-sync, powersync-api (+ one-shot powersync-setup under the `setup` profile)
- **No ports or resource limits** — those are in the override files
- **Healthchecks**: Defined per service (not overridden by overlays)
- **Service dependencies**: `depends_on` with health conditions
- **Config paths**: All reference `./docker/config/<service>/` and `./docker/dockerfiles/<service>/Dockerfile`

### Application Layer (`app.yml`)

Services that run in **staging and prod** only:

- **Services**: api, dashboard, marketing
- **Builds**: Each builds from `app/<name>/Dockerfile` (Hono API, TanStack Start dashboard, Astro marketing site) with the repo root as build context
- **Networks**: API and Dashboard attach to `backend` and `infrastructure`; Marketing is `backend` only (no data-layer access)
- **Dependencies**: API and Dashboard depend on pgbouncer, redis-primary, minio (all healthy)

### Observability (`observability.yml`)

Services that run in **staging and prod** only:

- **Services**: clickhouse, otel-collector, signoz-frontend
- **Dependencies**: OTEL depends on clickhouse and signoz-frontend (both healthy); SigNoz depends on clickhouse (healthy)
- **Volumes**: Declares the observability-only `clickhouse_data` volume

### Edge Layer (`edge.yml`, prod only)

- **Services**: caddy-active, caddy-standby, cloudflared
- **Networks**: Caddy on `edge` + `backend`; Cloudflared on `infrastructure`
- **Dependencies**: Keepalived depends on both Caddys (healthy)

### Scaling (`scaling.yml`, prod only)

- **Services**: postgres-replica-1, postgres-replica-2, redis-replica-1, redis-replica-2, redis-sentinel-1, redis-sentinel-2, redis-sentinel-3
- **Dependencies**: Replicas depend on primary (healthy); Sentinels depend on primary (healthy)

### Security (`security.yml`, prod + staging)

- **Services**: vault, minio-backup
- **Notes**: vault provides dynamic secrets + PKI (ADR-006); minio-backup is the off-site CRR target (ADR-012). Included in both Staging and Production.

## Override Responsibilities

### Dev Override (`profiles/dev.override.yml`)

| What it adds                          | Affected services                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Published ports to host               | All base services (Postgres 5432, Redis 6379, MinIO 9000/9001, PowerSync 8085, PgBouncer 6432) |
| Resource limits (1 CPU / 1GB)         | All services via `deploy.resources.limits`                                                     |
| MinIO init with local bucket creation | MinIO (init-minio-buckets.sh entrypoint)                                                       |
| Single instance per service           | No `deploy.replicas` set                                                                       |

### Staging Override (`profiles/staging.override.yml`)

| What it adds                     | Affected services                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Published ports to host          | All services including API 3001, Dashboard 8081, Marketing 8082, OTEL 4317/4318, SigNoz 3002 |
| Moderate resources (2 CPU / 2GB) | All services via `deploy.resources.limits`                                                   |
| Single instances                 | No replicas or sentinels                                                                     |
| Environment label                | `ENVIRONMENT: staging` on all services                                                       |

### Prod Override (`profiles/prod.override.yml`)

| What it adds                                   | Affected services                         |
| ---------------------------------------------- | ----------------------------------------- |
| Removes all published ports (`ports: []`)      | All services                              |
| High resources (4 CPU / 8GB) with reservations | All services                              |
| Service replicas                               | API (3), Dashboard (3), Marketing (3)     |
| Environment label                              | `ENVIRONMENT: production` on all services |

## Legacy Files

The root-level `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-compose.prod.yml` files have been **removed**. The modular `docker/compose/` structure is the sole active configuration.

## Network Assignment Rules

- **Edge**: Only Caddy, Keepalived (TLS termination, DMZ)
- **Backend**: API, Dashboard, Marketing (receive traffic from Caddy)
- **Infrastructure**: All data stores, Vault, observability stack (internal only, no internet)
- **Multi-network**: API and Dashboard attach to both `backend` and `infrastructure` for data-layer access; Marketing stays on `backend` only

See `docs/architecture/networking.md` for the full network topology and ADR-004 for the three-layer isolation design.
