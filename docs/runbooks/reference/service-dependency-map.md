# Service Dependency Map

## Dependency Tree

The tree below shows all services across all three environments. Services marked with † are production-only.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 0 (Parallel)                                          │
│  ┌──────────────────┐                                        │
│  │  vault †         │  No upstream deps. Provides secrets.   │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Data Stores (infra network, ALL environments)     │
│  ┌─────────────┐ ┌──────────────┐ ┌───────┐                 │
│  │ postgres-   │ │ redis-       │ │ minio │                 │
│  │ primary     │ │ primary      │ │       │                 │
│  └──────┬──────┘ └──┬────────┬───┘ └───┬───┘                 │
│         │           │        │         │                     │
│         │     ┌─────▼──┐ ┌───▼────┐    │                     │
│         │     │ redis- │ │ redis- │    │                     │
│         │     │replica-│ │replica-│    │                     │
│         │     │   1  † │ │   2  † │    │                     │
│         │     └────────┘ └────────┘    │                     │
│         │     ┌──────┐┌──────┐┌──────┐│                     │
│         │     │sent-1││sent-2││sent-3││                     │
│         │     │  †   ││  †   ││  †   ││                     │
│         │     └──────┘└──────┘└──────┘│                     │
└─────────┼─────────────────────────────┼─────────────────────┘
          │                             │
          ▼                             │
┌─────────────────┐                     │
│  Layer 2        │                     │
│  ┌───────────┐  │                     │
│  │ pgbouncer │◄─┘                     │
│  └─────┬─────┘                       │
└────────┼─────────────────────────────┼─────────────────────┘
         │                             │
         ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 3 — Application (backend+infra, staging+prod)         │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐                │
│  │ api      │  │ dashboard  │  │ marketing │                │
│  └──────────┘  └────────────┘  └───────────┘                │
└──────────────────────────┬───────────────────────────────────┘
                           │ emits OTLP
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 4 — Observability (infra, staging+prod)               │
│                                                              │
│  ┌────────────┐ writes ┌────────────────┐                    │
│  │ clickhouse │◄───────┤ otel-collector │                    │
│  │ (storage)  │        └────────────────┘                    │
│  └─────▲──────┘                                              │
│        │ queries                                             │
│  ┌─────┴───────────┐                                         │
│  │ signoz-frontend │                                         │
│  └─────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 5 — Edge (edge+backend, prod only) †                   │
│  ┌──────────────┐  ┌───────────────┐                         │
│  │ caddy-active │  │ caddy-standby │                         │
│  └──────┬───────┘  └───────────────┘                         │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 6 — HA (host network, prod only) †                     │
│  ┌──────────────┐                                              │
│  │ keepalived   │  Manages VIP between caddy-active/standby   │
│  └──────┬───────┘                                              │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 7 — Tunnel (infra, prod only) †                        │
│  ┌──────────────┐                                              │
│  │ cloudflared  │  Exposes SigNoz to Cloudflare edge           │
│  └──────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
```

**Legend:** † = prod only. Arrows indicate data flow dependency (upstream → downstream).

## Startup Order

The numbered order below respects all dependency edges. Services at the same number can start concurrently.

| Order | Services                                                     | Just Command                                     | Notes                                                                                                                                                           |
| ----- | ------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `vault` †                                                    | `just vault-unseal`                              | Must be unsealed before any secret-consuming service starts (prod + staging)                                                                                    |
| 2     | `postgres-primary`, `minio`, `redis-primary`                 | `just dev` / `just staging` / `just deploy prod` | Foundation data stores; no internal deps. Run in all environments.                                                                                              |
| 3     | `redis-replica-1`, `redis-replica-2`, `redis-sentinel-1/2/3` | (auto via compose depends_on)                    | Replicas sync from primary; sentinels monitor primary (prod only)                                                                                               |
| 4     | `pgbouncer`, `powersync-sync`, `powersync-api`               | (auto)                                           | Requires postgres-primary accepting connections; run `just ps-setup` once for DB provisioning                                                                   |
| 5     | `api`, `dashboard`, `marketing`                              | (auto)                                           | api connects to pgbouncer, redis, minio; dashboard connects to postgres via pgbouncer; marketing serves content with no database dependency (staging+prod only) |
| 6     | `clickhouse`, `signoz-frontend`                              | (auto)                                           | ClickHouse has no internal deps; SigNoz requires clickhouse healthy (staging+prod only)                                                                         |
| 7     | `otel-collector`                                             | (auto)                                           | Requires clickhouse + signoz-frontend healthy; pushes telemetry to clickhouse (staging+prod only)                                                               |
| 8     | `caddy-active`, `caddy-standby`                              | (auto)                                           | Reverse proxies to api, dashboard, and marketing on backend network (prod only)                                                                                 |
| 9     | `keepalived` †                                               | (auto)                                           | Binds VIP; requires both caddies healthy                                                                                                                        |
| 10    | `cloudflared` †                                              | (auto)                                           | Outbound tunnel to Cloudflare for SigNoz access                                                                                                                 |

## Shutdown Order

Reverse of startup: cloudflared → keepalived → caddy → otel/signoz → api/dashboard/marketing → pgbouncer → powersync-sync/powersync-api → redis replicas/sentinels → redis-primary, postgres, minio, clickhouse → vault.

## Failure Propagation Summary

| If this fails    | These are impacted                                                               | Environment   |
| ---------------- | -------------------------------------------------------------------------------- | ------------- |
| postgres-primary | pgbouncer → api/dashboard → caddy → end users                                    | all           |
| redis-primary    | api (sessions/cache), replicas, sentinels                                        | all           |
| minio            | api (object storage), backups (S3 target)                                        | all           |
| clickhouse       | otel-collector (metrics drop), signoz-frontend (no data)                         | staging, prod |
| vault †          | Any service needing secrets on restart                                           | prod          |
| caddy-active     | keepalived failover to caddy-standby (expected)                                  | prod          |
| cloudflared †    | SigNoz external access lost; all other traffic unaffected                        | prod          |
| powersync-sync   | Client apps stop receiving real-time sync updates; WAL may grow if slot inactive | all           |
