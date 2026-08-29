# Deployment Model

Three-environment Compose assembly, blue-green deployments, and CI/CD pipeline architecture.

## Modular Compose Assembly

The project uses a **12-file modular Docker Compose structure** in the `docker/compose/` directory. Instead of monolithic overlay files, services are split by concern (infrastructure, application, observability, edge, scaling, security) and assembled per environment using Docker Compose's multi-file merge strategy. Base modules define services without ports or resource limits; environment-specific overrides in `profiles/*.override.yml` add those.

### File Inventory

| File                                           | Purpose                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `docker/compose/networks.yml`                  | Network definitions (edge 172.20.0.0/24, backend 172.21.0.0/24, infrastructure 172.22.0.0/24) |
| `docker/compose/volumes.yml`                   | Named volume declarations for all stateful services                                           |
| `docker/compose/base.yml`                      | Core infrastructure: Postgres, PgBouncer, Redis, MinIO, PowerSync                             |
| `docker/compose/app.yml`                       | Application services: API, Dashboard, Marketing                                               |
| `docker/compose/observability.yml`             | ClickHouse storage, OTEL Collector, SigNoz frontend                                           |
| `docker/compose/edge.yml`                      | Caddy active/standby, Cloudflared                                                             |
| `docker/compose/scaling.yml`                   | Redis replicas x2, PostgreSQL replicas x2, Redis Sentinels x3                                 |
| `docker/compose/security.yml`                  | Vault, MinIO backup (Staging + Prod)                                                          |
| `docker/compose/profiles/dev.override.yml`     | Dev: published ports, low resources (1 CPU / 1GB), infrastructure only                        |
| `docker/compose/profiles/staging.override.yml` | Staging: published ports, moderate resources (2 CPU / 2GB), app + observability               |
| `docker/compose/profiles/prod.override.yml`    | Prod: no published ports, high resources (4 CPU / 8GB), full HA stack                         |

### Three-Environment Tiers

| Tier        | Files                                                                         | Services | Description                                                                           |
| ----------- | ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| **Dev**     | networks + volumes + base + dev.override                                      | 5        | Databases, caches, storage, sync. No app or observability.                            |
| **Staging** | base + app + observability + staging.override                                 | 11       | Dev services + ClickHouse, OTEL, SigNoz, API, Dashboard, Marketing. Single instances. |
| **Prod**    | base + app + observability + edge + scaling + security + sync + prod.override | 25       | Full stack with HA, Vault, replicas, edge, tunnel.                                    |

### Invocation

```bash
# Dev (5 services — infrastructure only)
docker compose \
  -f docker/compose/networks.yml \
  -f docker/compose/volumes.yml \
  -f docker/compose/base.yml \
  -f docker/compose/profiles/dev.override.yml \
  up -d

# Staging (20 services — infrastructure + applications + monitoring)
docker compose \
  -f docker/compose/networks.yml \
  -f docker/compose/volumes.yml \
  -f docker/compose/base.yml \
  -f docker/compose/app.yml \
  -f docker/compose/observability.yml \
  -f docker/compose/security.yml \
  -f docker/compose/profiles/staging.override.yml \
  up -d

# Prod (31 services — full HA stack)
docker compose \
  -f docker/compose/networks.yml \
  -f docker/compose/volumes.yml \
  -f docker/compose/base.yml \
  -f docker/compose/app.yml \
  -f docker/compose/observability.yml \
  -f docker/compose/edge.yml \
  -f docker/compose/scaling.yml \
  -f docker/compose/security.yml \
  -f docker/compose/profiles/prod.override.yml \
  up -d
```

The Just aliases `DEV_COMPOSE`, `STAGING_COMPOSE`, and `PROD_COMPOSE` wrap these multi-file commands for everyday use.

### Legacy Files

The root-level `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-compose.prod.yml` files have been removed. The modular `docker/compose/` structure is the sole active configuration.

## Blue-Green Deployment via Caddy

The deployment strategy uses Caddy's [weighted upstreams](https://caddyserver.com/docs/caddyfile/dynamic-upstreams) to route traffic between two versions of each application service.

### Architecture

```
Caddy
 ├── api (Docker service discovery, replicas in prod) :3000
 ├── dashboard (Docker service discovery, replicas in prod) :8080
 └── marketing (Docker service discovery, replicas in prod) :8080
```

### DEPLOY_VERSION Environment Variable

A single env var controls which color slot receives traffic:

| `DEPLOY_VERSION` | api-blue weight | api-green weight | Effect                        |
| ---------------- | --------------- | ---------------- | ----------------------------- |
| `blue`           | 100             | 0                | Blue is live, green is idle   |
| `green`          | 0               | 100              | Green is live, blue is idle   |
| `canary:10`      | 90              | 10               | 10% traffic to green (canary) |

### Deployment Sequence

```bash
# 1. Deploy new version to production
just deploy-prod <version>

# 2. Check deployment status
just deployment-status

# 3. Adjust upstream weights if needed (e.g., canary)
just dynamic-upstream <args>

# 4. Monitor — if issues detected, rollback:
just rollback
```

### dynamic-upstream.sh

The `dynamic-upstream.sh` script modifies Caddy's admin API at `localhost:2019` at runtime (it does not rewrite files):

```bash
# Usage
./scripts/deploy/dynamic-upstream.sh api green 100

# Internally:
# 1. Reads current Caddy config
# 2. Updates lb weights for api-blue / api-green
# 3. Issues POST to Caddy's admin API (localhost:2019)
# 4. Waits for config reload confirmation
```

The admin API is bound to `127.0.0.1:2019` and is not accessible from other networks.

### Rollback Procedure

```bash
# Immediate rollback to previous deployment
just rollback
```

Rollback is instantaneous — it is a config change via the Caddy admin API, not a container restart.

## CI/CD Pipeline Architecture

Four workflow files in `.github/workflows/`:

- **ci.yml** — lint, typecheck, unit test, build, integration test, publish artifact (image tagged with immutable git SHA)
- **security.yml** — dependency audit, config check, compose validation, container scanning (Trivy)
- **deploy-staging.yml** — consume CI artifact, deploy to staging, health check
- **deploy-prod.yml** — consume CI artifact, approval gate (2 reviewers), deploy to prod, health check, rollback

Artifact flow: CI builds images tagged with git SHA → security scans those images → deploy-staging/deploy-prod consume the exact same artifact.

### Pipeline Guards

| Guard                    | Threshold | Action                            |
| ------------------------ | --------- | --------------------------------- |
| Trivy HIGH CVE           | > 0       | Block merge                       |
| Trivy CRITICAL CVE       | > 0       | Block merge                       |
| Integration test failure | Any       | Block deployment                  |
| Smoke test failure       | Any       | Auto-rollback via `just rollback` |
| Health check timeout     | 60s       | Alert on-call, hold traffic       |

## Canary Deployments

For gradual rollout, the deployment supports percentage-based traffic splitting via `just dynamic-upstream`:

```bash
# Adjust upstream weights for canary rollout
just dynamic-upstream <args>

# Monitor deployment status
just deployment-status
```

Observability data (p99 latency, error rate) from SigNoz is checked between each step. If error rate exceeds 1% or p99 latency increases > 50%, the canary is automatically aborted and traffic reverts via `just rollback`.
