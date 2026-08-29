# ClickHouse 25.12

> **Columnar storage backend** for the SigNoz observability platform. All metrics, distributed traces, and structured logs exported by the signoz-otel-collector are stored and queried here.

---

## Overview

| Property              | Value                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- |
| **Image**             | `clickhouse/clickhouse-server:25.12.5` (+ `clickhouse-keeper:25.12.5` coordination sidecar) |
| **Container Ports**   | 8123 (HTTP), 9000 (native TCP)                                                              |
| **Staging Host Port** | `127.0.0.1:${CLICKHOUSE_HTTP_PORT:-8123}` → 8123                                            |
| **Network**           | `infrastructure` (internal: true)                                                           |
| **Compose Module**    | `docker/compose/observability.yml`                                                          |
| **Environments**      | Staging, Prod                                                                               |

Pinned ≥ **25.12.5**: newer `signoz-otel-collector` releases store trace
attributes as JSON columns whose schema migration requires settings
introduced in 25.12.5 (see the SigNoz 0→0.131 upgrade guide).

---

## Configuration Files

| File                                         | Purpose                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docker/config/clickhouse/config.xml`        | Listen addresses, port bindings, memory limits, single-node `default_cluster` + zookeeper config  |
| `docker/config/clickhouse/keeper-config.xml` | Single-node Keeper (raft) coordination settings — mounted at the entrypoint's exact expected path |

Mounted read-only at `/etc/clickhouse-server/config.d/custom.xml`.

> **Never put credentials in this file** — `${VAR}` placeholders are NOT substituted by either the image entrypoint or ClickHouse itself.

## Authentication

Single `default` user; the password is applied by the image entrypoint from
the required `CLICKHOUSE_PASSWORD` env var. Access is restricted to the
internal infrastructure network (no published ports in prod). Least-privilege
per-service ClickHouse users are a documented future hardening step.

## Schema & Cluster

The `default_cluster` remote_servers block (single shard, self-referencing,
replication disabled) exists only so the `signoz-otel-collector-migrate`
job can run with `--clickhouse-cluster=default_cluster --clickhouse-replication=false`.

**ClickHouse Keeper is required even single-node**: the migrate job's
`bootstrap` step resolves `ON CLUSTER` DDL through Zookeeper config and
fails without it (upstream [signoz-otel-collector#808](https://github.com/SigNoz/signoz-otel-collector/issues/808)).
A single Keeper node runs alongside ClickHouse; production at scale should
move to a 3-node Keeper quorum with a replicated cluster.

Schema lifecycle:

1. `otel-collector-migrate` one-shot runs `migrate bootstrap/sync/async`,
   creating `signoz_traces`, `signoz_metrics`, `signoz_logs` (+ analytics/
   metadata) databases.
2. `otel-collector` and SigNoz start only after migrations complete
   (`service_completed_successfully`).

Re-run migrations manually after a version upgrade:
`docker compose ... run --rm otel-collector-migrate`

---

## Data Retention & TTL

TTLs are managed by **SigNoz's retention manager** from env vars on the
SigNoz container — no manual TTL scripts (initdb.d scripts would run before
the tables exist and never re-run):

| Variable                        | Default | Controls                                   |
| ------------------------------- | ------- | ------------------------------------------ |
| `SIGNOZ_METRICS_RETENTION_DAYS` | 7       | How long metric samples are stored         |
| `SIGNOZ_TRACES_RETENTION_DAYS`  | 7       | How long trace spans are stored            |
| `SIGNOZ_LOGS_RETENTION_DAYS`    | 7       | How long structured log entries are stored |

Verify active TTLs with `just ch-health`.

> **Tuning guidance:** Adjust these based on storage capacity, compliance requirements, and query performance needs. Longer retention increases storage consumption linearly.

---

## Integration

```
Application Services → OTLP → signoz-otel-collector → ClickHouse
                                                          ↑
                              SigNoz (query/UI, metadata in Postgres)
```

The collector exports telemetry directly over ClickHouse's native TCP port;
SigNoz's query service reads from ClickHouse to render dashboards, execute
trace queries, and evaluate alert conditions.

---

## Port Exposure

| Environment | Ports                          | Access                                                                        |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Staging     | `8123` (HTTP) — loopback-bound | Ad-hoc queries from the host (`curl 'http://localhost:8123/?query=SELECT 1'`) |
| Prod        | None published                 | Accessed only by collector and SigNoz on the `infrastructure` network         |

---

## Health Check

```yaml
healthcheck:
  test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:8123/ping']
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

The unauthenticated `/ping` endpoint verifies the HTTP server is accepting
connections without exposing credential material in the compose file.

---

## Operational Notes

- **I/O intensity** — ClickHouse is extremely I/O-intensive. Ensure the host's storage subsystem can sustain the write throughput generated by the collector under peak load.
- **Memory** — container limits live in the profile overrides; `max_memory_usage` / cache sizes in `config.xml` must stay below them to avoid OOM kills.
- **open files** — `ulimits.nofile` is raised to 262144 (ClickHouse recommends high fd limits).
- **Direct SQL access** — staging: loopback HTTP :8123; prod: `docker exec` with `just ch-health` / `just logs clickhouse`.
