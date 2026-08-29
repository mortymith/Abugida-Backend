# Service Catalogue

> **Single source of truth** for all platform services — dependency chains, network segmentation, startup ordering, and per-environment availability.

---

## Overview

This catalogue documents every service that composes the platform infrastructure. Services are assembled from modular Compose files under `docker/compose/`, with each environment tier activating a progressively larger surface area. This document is intended for platform operators, on-call engineers, and anyone integrating with the infrastructure.

---

## Environment Tiers

| Tier        | Compose Modules                                                     | Services | Purpose                                                           |
| ----------- | ------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| **Dev**     | `networks` + `volumes` + `base` + `dev.override`                    | 5        | Local development with core data stores and sync                  |
| **Staging** | Dev modules + `app` + `observability` + `staging.override`          | 11       | Pre-production validation with application and telemetry          |
| **Prod**    | Staging modules + `edge` + `scaling` + `security` + `prod.override` | 25       | Full production with HA ingress, secrets management, and replicas |

---

## Startup Order & Dependency Chain

Docker Compose resolves boot order via `depends_on` blocks using `condition: service_healthy`. A service will not transition to `running` until every declared dependency has passed its health check. This guarantees infrastructure-layer services are fully initialised before application or observability components attempt to connect.

```
Phase 1 — Infrastructure
  PostgreSQL · Redis (primary) · MinIO · Vault

Phase 2 — Pooling & Observability
  PgBouncer → API / Dashboard
  Sentinel → API
  MinIO → API
  ClickHouse → SigNoz Frontend → OTEL Collector
  PostgreSQL → PowerSync

Phase 3 — Application
  API (depends on PgBouncer, Redis, MinIO — all healthy)
  Dashboard (depends on PgBouncer, Redis — all healthy)
  Marketing (no dependencies)

Phase 4 — Ingress (prod only)
  Caddy (active + standby)

Phase 5 — HA & Tunnel (prod only)
  Keepalived → VIP migration
  Cloudflared → Outbound tunnel to Cloudflare edge

Phase 6 — One-Shot Init (prod only)
  init-minio (creates buckets & attaches policies)
```

---

## Dependency Matrix

| Service            | Depends On                                 | Network(s)                  | Environments  | Phase        |
| ------------------ | ------------------------------------------ | --------------------------- | ------------- | ------------ |
| PostgreSQL         | _(none)_                                   | `infrastructure`            | all           | 1 — Infra    |
| PgBouncer          | PostgreSQL (healthy)                       | `infrastructure`            | all           | 2 — Pool     |
| Redis (primary)    | _(none)_                                   | `infrastructure`            | all           | 1 — Infra    |
| Redis (replica x2) | Redis primary (healthy)                    | `infrastructure`            | prod          | 1 — Infra    |
| Sentinel (x3)      | Redis primary (healthy)                    | `infrastructure`            | prod          | 2 — Sentinel |
| MinIO              | _(none)_                                   | `infrastructure`            | all           | 1 — Infra    |
| MinIO Backup       | MinIO (healthy)                            | `infrastructure`            | prod          | 1 — Infra    |
| ClickHouse         | _(none)_                                   | `infrastructure`            | staging, prod | 2 — Observe  |
| PowerSync          | PostgreSQL (healthy)                       | `infrastructure`            | all           | 2 — Sync     |
| Vault              | _(none)_                                   | `infrastructure`            | prod          | 1 — Infra    |
| API                | PgBouncer, Redis, MinIO (all healthy)      | `backend`, `infrastructure` | staging, prod | 3 — App      |
| Dashboard          | PgBouncer, Redis (both healthy)            | `backend`, `infrastructure` | staging, prod | 3 — App      |
| Marketing          | _(none)_                                   | `backend`                   | staging, prod | 3 — App      |
| OTEL Collector     | ClickHouse, SigNoz (both healthy)          | `infrastructure`            | staging, prod | 3 — Observe  |
| SigNoz Frontend    | ClickHouse (healthy)                       | `infrastructure`            | staging, prod | 2 — Observe  |
| Caddy (active)     | _(none)_                                   | `edge`, `backend`           | prod          | 4 — Ingress  |
| Caddy (standby)    | _(none)_                                   | `edge`, `backend`           | prod          | 4 — Ingress  |
| Cloudflared        | _(none)_                                   | `infrastructure`            | prod          | 5 — Tunnel   |
| Keepalived         | Caddy active, Caddy standby (both healthy) | host network                | prod          | 5 — HA       |
| init-minio         | MinIO, MinIO Backup (both healthy)         | `infrastructure`            | prod          | One-shot     |

---

## Network Segmentation

Traffic is isolated across three Docker bridge networks, each representing a trust boundary:

| Network            | Members                                                                                      | Trust Level       | Description                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| **edge**           | Caddy (active), Caddy (standby)                                                              | Untrusted inbound | Accepts external traffic only via VIP or Cloudflare tunnel                     |
| **backend**        | API, Dashboard, Marketing                                                                    | Semi-trusted      | Application-layer services; cross-attaches to `infrastructure` for data access |
| **infrastructure** | PostgreSQL, PgBouncer, Redis, MinIO, ClickHouse, Vault, OTEL, SigNoz, PowerSync, Cloudflared | Trusted internal  | All data stores, observability, and internal tooling                           |

Cross-network access is controlled at the Compose level. Services requiring access to multiple networks (e.g., API, Dashboard) are explicitly dual-attached. No service on the `infrastructure` network is reachable from `edge` without traversing the `backend` layer.

---

## Health Check Conventions

Every service exposes a health check via HTTP endpoint or native CLI command. The platform uses uniform parameters across all services:

| Parameter      | Value |
| -------------- | ----- |
| `interval`     | 10 s  |
| `timeout`      | 5 s   |
| `retries`      | 5     |
| `start_period` | 30 s  |

This consistency ensures predictable dependency resolution and uniform behaviour during rolling restarts, scaling events, and failover scenarios.

---

## Service Directory

Detailed per-service documentation is available below:

### Data Layer

| Service       | Document                   | Summary                                                                                                 |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| PostgreSQL 17 | [postgres.md](postgres.md) | Primary relational database with WAL archival, streaming replication, and PgBouncer connection pooling  |
| Redis 7.4     | [redis.md](redis.md)       | In-memory data store with Sentinel-managed HA, ACL-based access control, and hybrid RDB+AOF persistence |
| MinIO         | [minio.md](minio.md)       | S3-compatible object storage with IAM policies, cross-region replication, and lifecycle rules           |

### Application Layer

| Service   | Document                     | Summary                                                                                  |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| API       | [api.md](api.md)             | Primary backend service (Bun + Hono) handling business logic, CRUD, and authentication   |
| Dashboard | [dashboard.md](dashboard.md) | Customer-facing web application (TanStack Start) with SSR, backed by PgBouncer and Redis |
| Marketing | [marketing.md](marketing.md) | Static Astro landing page served by Bun — no data-layer dependencies                     |
| PowerSync | [powersync.md](powersync.md) | Real-time offline-first data sync via PostgreSQL logical replication                     |

### Observability Layer

| Service         | Document                               | Summary                                                                                      |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| OTEL Collector  | [otel-collector.md](otel-collector.md) | Central telemetry pipeline ingesting metrics, traces, and logs from all services             |
| ClickHouse 24.8 | [clickhouse.md](clickhouse.md)         | Columnar storage backend for SigNoz with automatic TTL-based data retention                  |
| SigNoz          | [signoz.md](signoz.md)                 | Observability platform with dashboards, trace exploration, log search, and Telegram alerting |

### Ingress & Security Layer

| Service     | Document                         | Summary                                                                               |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Caddy       | [caddy.md](caddy.md)             | Automatic TLS termination and reverse proxy with active-standby HA via Keepalived VIP |
| Keepalived  | [keepalived.md](keepalived.md)   | VRRP-based virtual IP failover between active and standby Caddy instances             |
| Vault       | [vault.md](vault.md)             | HashiCorp Vault centralising secrets management with dynamic credential generation    |
| Cloudflared | [cloudflared.md](cloudflared.md) | Outbound tunnel to Cloudflare edge — no inbound ports required on the host            |

---

## Quick Reference: Port Map

| Service       | Container Port | Dev Host Port | Prod Exposed         |
| ------------- | -------------- | ------------- | -------------------- |
| PostgreSQL    | 5432           | 5432          | No                   |
| PgBouncer     | 6432           | 6432          | No                   |
| Redis         | 6379           | 6379          | No                   |
| MinIO S3 API  | 9000           | 9000          | No                   |
| MinIO Console | 9001           | 9001          | No                   |
| ClickHouse    | 8123           | —             | No (staging: 8123)   |
| API           | 3000           | 3001          | No (via Caddy)       |
| Dashboard     | 8080           | 8081          | No (via Caddy)       |
| Marketing     | 8080           | 8082          | No (via Caddy)       |
| PowerSync     | 8085           | 8085          | No                   |
| SigNoz        | 3001           | 3002          | No (via Cloudflared) |
| OTEL gRPC     | 4317           | —             | No                   |
| OTEL HTTP     | 4318           | —             | No                   |
