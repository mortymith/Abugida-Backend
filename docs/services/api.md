# API Service

> **Primary backend** handling business logic, authentication, data orchestration, and all CRUD operations. Built on the Bun runtime with the Hono web framework.

---

## Overview

| Property           | Value                       |
| ------------------ | --------------------------- |
| **Runtime**        | Bun 1.2.1-alpine            |
| **Framework**      | Hono                        |
| **Container Port** | 3000                        |
| **Dev Host Port**  | 3001                        |
| **Replicas**       | 1 (dev), 3 (prod)           |
| **Networks**       | `backend`, `infrastructure` |
| **Environments**   | Staging, Prod               |

---

## Multi-Stage Dockerfile

The build uses two stages to minimise final image size and eliminate build-time dependencies from runtime:

```dockerfile
FROM oven/bun:1.2.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build ./src/index.ts --outdir ./dist

FROM oven/bun:1.2.1-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
USER app
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

The runtime stage runs as a non-root user (`app`), limiting the blast radius of any container compromise. Build tools, source maps, and the Bun package manager are excluded from the final image.

---

## Dependencies

| Service                  | Connection        | Purpose                                          |
| ------------------------ | ----------------- | ------------------------------------------------ |
| PgBouncer (`:6432`)      | Pooled PostgreSQL | Transactional data, user records, business state |
| Redis (`:6379`)          | Direct            | Session storage, caching, feature flags          |
| MinIO (`:9000`)          | S3 API            | File uploads, object storage, blob data          |
| OTEL Collector (`:4317`) | gRPC              | Metrics, traces, and logs export                 |

All dependencies use `condition: service_healthy`, ensuring the API only starts after every backend service is confirmed operational.

---

## Environment Variables

| Variable                      | Purpose                                              | Source                            |
| ----------------------------- | ---------------------------------------------------- | --------------------------------- |
| `PGBOUNCER_HOST`              | PgBouncer address for pooled DB connections          | Compose service discovery         |
| `REDIS_HOST`                  | Redis primary address for session/cache operations   | Compose service discovery         |
| `MINIO_HOST`                  | MinIO address for object storage                     | Compose service discovery         |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel Collector gRPC endpoint                         | Hardcoded (`otel-collector:4317`) |
| `DEPLOY_VERSION`              | Deployment version label for observability filtering | CI/CD pipeline                    |

### Secrets

Four sensitive values are injected as environment variables — from `.env` in development, exported from Vault in staging/production (ADR-006):

| Variable              | Used For                     |
| --------------------- | ---------------------------- |
| `POSTGRES_PASSWORD`   | PgBouncer authentication     |
| `REDIS_PASSWORD`      | Redis ACL authentication     |
| `MINIO_ROOT_PASSWORD` | MinIO service account        |
| `API_SECRET_KEY`      | JWT signing, request signing |

---

## Health Check

The service exposes a `/health` endpoint that verifies connectivity to all downstream dependencies (PgBouncer, Redis, MinIO) and returns HTTP 200 when all checks pass. Docker probes this endpoint for load balancing and dependency resolution.

---

## Deployment Topology

| Environment | Replicas | Port Exposure      | Ingress                    |
| ----------- | -------- | ------------------ | -------------------------- |
| Dev         | 1        | `3001:3000` (host) | Direct access              |
| Prod        | 3        | None published     | Via Caddy on `/api/*` path |

In production, all three replicas are registered in Caddy's upstream pool with `least_conn` load balancing. Blue-green and canary deployments shift traffic between replica sets using `scripts/deploy/dynamic-upstream.sh`.

---

## Related Scripts

| Script                         | Purpose                           |
| ------------------------------ | --------------------------------- |
| `scripts/deploy/deploy.sh`     | Standard deployment orchestration |
| `scripts/deploy/blue-green.sh` | Blue-green traffic switch         |
| `scripts/deploy/canary.sh`     | Canary percentage-based rollout   |
| `scripts/deploy/rollback.sh`   | Rollback to previous deployment   |
| `scripts/deploy/migrate.sh`    | Database migration execution      |
