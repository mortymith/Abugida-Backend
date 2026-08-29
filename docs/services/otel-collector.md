# OpenTelemetry Collector

> **Central telemetry pipeline** ingesting metrics, traces, and structured logs from all application services, with processing, enrichment, and direct export to ClickHouse. Uses SigNoz's collector fork, which adds native ClickHouse exporters and span-metrics generation on top of opentelemetry-collector-contrib.

---

## Overview

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Image**           | `signoz/signoz-otel-collector:v0.144.8`            |
| **gRPC Receiver**   | Port 4317                                          |
| **HTTP Receiver**   | Port 4318                                          |
| **Health Endpoint** | Port 13133 (loopback-bound)                        |
| **Self-telemetry**  | Port 8888 (scraped by its own prometheus receiver) |
| **Network**         | `infrastructure` only                              |
| **Environments**    | Staging, Prod                                      |

The SigNoz fork is required: the core/contrib distributions lack the
`clickhousetraces`, `signozclickhousemetrics`, and `clickhouselogsexporter`
exporters and the `signozspanmetrics` processor used by our pipeline config.

---

## Configuration Structure

A single bind-mounted file:

```
docker/config/opentelemetry/collector-config.yml
```

ClickHouse credentials arrive via `CLICKHOUSE_*` environment variables
(set in observability.yml) using `${env:VAR}` substitution — secrets are
never embedded in the config file itself.

---

## Receivers

| Receiver   | Port | Transport | Use Case                                                                                    |
| ---------- | ---- | --------- | ------------------------------------------------------------------------------------------- |
| OTLP gRPC  | 4317 | gRPC      | Primary path — high-throughput telemetry from application SDKs                              |
| OTLP HTTP  | 4318 | HTTP/JSON | Compatibility path — SDKs and agents that prefer HTTP transport                             |
| Prometheus | —    | pull      | Scrapes the collector's own metrics (:8888) and PowerSync (:9090, replication-lag alerting) |

---

## Processing Pipeline

| Stage                       | Purpose                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **memory_limiter**          | Always first — throttles intake at 75% of container memory to prevent OOM                                                                       |
| **resource/environment**    | Stamps `deployment.environment` + `service.instance.id` for environment segmentation in SigNoz                                                  |
| **filter/drop-debug**       | Removes debug-level spans/logs/datapoints to reduce storage noise and cost                                                                      |
| **signozspanmetrics/delta** | Traces only — derives RED metrics (call/error rate, latency histograms) from spans so SigNoz can chart service latency without app-side metrics |
| **batch**                   | Always last — groups telemetry into batches (10s timeout), reducing downstream network overhead and ClickHouse write amplification              |

---

## Exporters

| Exporter                  | Target                                        | Purpose                                 |
| ------------------------- | --------------------------------------------- | --------------------------------------- |
| `clickhousetraces`        | `clickhouse:9000` → database `signoz_traces`  | Trace spans (long-term storage)         |
| `signozclickhousemetrics` | `clickhouse:9000` → database `signoz_metrics` | OTLP metrics + span-derived RED metrics |
| `clickhouselogsexporter`  | `clickhouse:9000` → database `signoz_logs`    | Structured logs                         |

All exporters retry transient failures with exponential backoff
(5s → 30s, 5-minute budget).

---

## Schema Lifecycle & Dependencies

```yaml
depends_on:
  clickhouse:
    condition: service_healthy
  otel-collector-migrate:
    condition: service_completed_successfully
```

ClickHouse schema migrations run in a dedicated one-shot job
(`otel-collector-migrate`: `migrate bootstrap/sync/async`) BEFORE the
collector starts — so ingestion begins immediately once migrations finish,
instead of the collector blocking its own startup on a serial schema build.
SigNoz is NOT a startup dependency: the collector exports straight to
ClickHouse.

---

## Data Flow

```
API (Hono SDK) ──────────┐
Dashboard (TanStack) ─────┤
                          ├──→ OTEL Collector ──→ ClickHouse ──→ SigNoz (query + UI)
Other services ───────────┘
PowerSync (:9090) ──→ (prometheus scrape)
```

---

## Operational Notes

- **Resource limits** are enforced in both environments to prevent the collector from consuming excessive CPU or memory under telemetry load spikes.
- **Backpressure** — if the collector falls behind, the memory limiter refuses/throttles intake before queues grow unbounded. Monitor via `just otel-status`.
- **Health probe** — the image ships bash but no wget; healthchecks use `/dev/tcp` (`bash -c 'echo > /dev/tcp/127.0.0.1/13133'`).
- **Staging exposure** — OTLP ports are published loopback-only for host-side senders; the health port stays internal.
