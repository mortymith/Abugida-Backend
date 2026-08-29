# SigNoz

> **Unified observability platform** providing metrics dashboards, distributed trace exploration, log search, and Telegram-powered alerting. Runs as a single consolidated container (UI + API server) with ClickHouse as its telemetry store and PostgreSQL (via PgBouncer) as its metadata store.

---

## Overview

| Property              | Value                                                         |
| --------------------- | ------------------------------------------------------------- |
| **Image**             | `signoz/signoz:v0.137.0`                                      |
| **Components**        | UI + Query Service + Alerting (single container)              |
| **Telemetry storage** | ClickHouse (`signoz_traces`, `signoz_metrics`, `signoz_logs`) |
| **Metadata storage**  | PostgreSQL via PgBouncer — database `signoz`                  |
| **Container Port**    | 8080 (UI + API on the same port)                              |
| **Staging Host Port** | `127.0.0.1:${SIGNOZ_FRONTEND_PORT:-3002}` → 8080              |
| **Network**           | `infrastructure` only                                         |
| **Environments**      | Staging, Prod                                                 |

---

## Configuration

Configuration is env-var driven: every `SIGNOZ_*` variable maps to a
config path (single `_` separates segments, `__` escapes a literal
underscore). DSNs embed credentials, so they are assembled in-shell by
the container command rather than interpolated by compose:

```yaml
environment:
  # Telemetry store (ClickHouse)
  SIGNOZ_TELEMETRYSTORE_CLICKHOUSE_DSN: tcp://clickhouse:9000?username=...&password=...
  # Metadata store — Postgres via PgBouncer
  SIGNOZ_SQLSTORE_PROVIDER: postgres
  SIGNOZ_SQLSTORE_POSTGRES_DSN: postgres://signoz:...@pgbouncer:6432/signoz?sslmode=disable
  # UI session/token signing secret
  SIGNOZ_TOKENIZER_JWT_SECRET: ${SIGNOZ_JWT_SECRET}
```

> **Tuning guidance:** Retention variables drive SigNoz's retention manager, which applies table TTLs inside ClickHouse automatically. Do NOT add manual TTL scripts — `/docker-entrypoint-initdb.d` runs before SigNoz creates its tables and never re-runs.

---

## Metadata Store Lifecycle

SigNoz keeps alerts, dashboards, saved views and org config in the `signoz` database on postgres-primary:

1. `signoz-db-setup` (base.yml one-shot) idempotently creates the `signoz`
   role + database and syncs the role password — runs on EVERY stack start,
   enabling credential rotation by simply changing `SIGNOZ_DB_PASSWORD`.
2. `pgbouncer-init` copies the role's SCRAM verifier into PgBouncer's
   auth file (`PGBOUNCER_AUTH_USERS=app,signoz`).
3. `signoz-frontend` connects through PgBouncer :6432 (transaction pooling;
   prepared statements supported via `max_prepared_statements`).

---

## Alerting

Alert rules are managed in the SigNoz UI/API (stored in the metadata DB). Matched alerts route to **Telegram** when `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are set:

| Category                | Examples                                         |
| ----------------------- | ------------------------------------------------ |
| **Latency**             | p95 request latency exceeding defined thresholds |
| **Error rates**         | HTTP 5xx percentage above acceptable baselines   |
| **Resource saturation** | CPU, memory, and disk usage approaching limits   |
| **Replication lag**     | Redis and PostgreSQL replication delay           |

---

## Access

| Environment | Access Method                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Staging     | `127.0.0.1:${SIGNOZ_FRONTEND_PORT:-3002}` — loopback-only browser access for debugging                          |
| Prod        | Cloudflared tunnel — accessible via configured domain (e.g., `signoz.example.com`). No ports published to host. |

---

## Operational Notes

- **Startup dependencies** — waits for ClickHouse _and_ PgBouncer to be healthy; ClickHouse schema itself is built beforehand by the `otel-collector-migrate` one-shot job.
- **Health endpoint** — `GET :8080/api/v1/health` (used by compose healthcheck, `just health`, Caddy, and tunnel tests).
- **Backup** — telemetry data via `just backup-monitoring`; metadata via `just backup-postgres`.
- **Telegram integration** — requires valid `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Without them, alert delivery is disabled.
