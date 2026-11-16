# Worker Service

> **Background job consumer** that drains the BullMQ queues the API and the dashboard fill. Built on the Bun runtime, it owns the consumer half of `@abugida/queue` (ADR-028).

---

## Overview

| Property           | Value                           |
| ------------------ | ------------------------------- |
| **Runtime**        | Bun 1.4.4-alpine                |
| **Framework**      | — (plain Bun, no web framework) |
| **Container Port** | 3000                            |
| **Dev Host Port**  | 3003                            |
| **Replicas**       | 1 (staging), 2 (prod)           |
| **Networks**       | `infrastructure`                |
| **Environments**   | Staging, Prod                   |

The worker is the only process that _runs_ jobs. Producers (the API, the dashboard) fill the queues through the shared `@abugida/queue` package; the worker consumes them.

Because the split is one-way (`app/worker` → `@abugida/queue`), the package carries the **job contract** — `JobType`, the payload interfaces, `QUEUE_NAMES`, `JOB_QUEUE_MAP`, the validators and the `QueueError` hierarchy — plus the **producer runtime** (`createQueueClient`, the Redis connection helpers). Everything consumer-specific (the BullMQ runtime, the nine processor modules, the Telebirr/SMSEthiopia integrations, the idempotency and error helpers) lives here.

---

## Dependencies

| Service                  | Connection | Purpose                              |
| ------------------------ | ---------- | ------------------------------------ |
| Redis (`:6379`)          | Direct     | BullMQ queue store, idempotency keys |
| OTEL Collector (`:4317`) | gRPC       | Metrics, traces, and logs export     |

Redis is the only hard dependency, and it is awaited with `condition: service_healthy` before the worker starts. PostgreSQL is not a dependency _yet_: the processors that write to the database are still stubs (see [Processor status](#processor-status)).

---

## Environment Variables

| Variable                      | Purpose                                             | Source                               |
| ----------------------------- | --------------------------------------------------- | ------------------------------------ |
| `REDIS_HOST` / `REDIS_PORT`   | Queue store address (compose: `redis-primary:6379`) | Compose service discovery            |
| `REDIS_PASSWORD`              | Redis ACL password                                  | `.env` (dev) / Vault (staging, prod) |
| `WORKER_QUEUES`               | Which queues this instance consumes                 | Deployment configuration             |
| `APP_NAME`                    | Worker identity (`<APP_NAME>-worker-<pid>`)         | Deployment configuration             |
| `PORT`                        | Port of the health endpoint (container: 3000)       | Compose                              |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel Collector gRPC endpoint                        | Hardcoded (`otel-collector:4317`)    |

### Queue selection

`WORKER_QUEUES` is either `all` (every declared queue) or a comma-separated list of full queue names:

```bash
WORKER_QUEUES=abugida.purchases,abugida.webhooks
```

An unknown queue name fails fast at start-up — a typo would otherwise start a worker that silently consumes nothing. The setting is the **per-queue rollout gate**: the queues whose processors are implemented are enabled one at a time.

### Secrets

The worker is the only process that calls the Telebirr payment gateway and the SMSEthiopia SMS API, so their credentials live here alone (ADR-028 §2):

| Variable                   | Used For                                |
| -------------------------- | --------------------------------------- |
| `TELEBIRR_APP_SECRET`      | Telebirr request signing                |
| `TELEBIRR_MERCHANT_APP_ID` | Telebirr merchant identity              |
| `TELEBIRR_MERCHANT_CODE`   | Telebirr merchant code                  |
| `TELEBIRR_PRIVATE_KEY`     | Telebirr request signing (PEM)          |
| `TELEBIRR_PUBLIC_KEY`      | Telebirr response/callback verification |
| `SMS_ETHIOPIA_API_KEY`     | SMSEthiopia API authentication          |

In staging and production they are fetched from Vault by `entrypoint.sh`; in development they come from `.env`. Every one of them is optional: a worker without them starts, but the corresponding processor fails permanently instead of calling the gateway.

---

## Health Endpoints

| Endpoint            | Meaning                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| `GET /health`       | Liveness — the process is up. Never fails.                                      |
| `GET /health/ready` | Readiness — Redis is reachable **and** every expected queue worker has started. |

`/health` is what the compose healthcheck curls. `/health/ready` is what `just health` and the ops tooling use: it returns `503` with `status: "degraded"` while Redis is unreachable or a queue worker is still starting.

```bash
just health-worker              # liveness + readiness from the host
just health-worker --strict     # exit non-zero on failure
```

---

## Processor status

The processors that are still placeholders **throw `BullMQ.UnrecoverableError` instead of returning success**. BullMQ then keeps the job in the failed set (`removeOnFail`) rather than completing it and dropping it (`removeOnComplete`) — a consumer can never silently discard queued work it did not perform (ADR-028, Risks).

| Processor                    | State                                            |
| ---------------------------- | ------------------------------------------------ |
| `PURCHASE_INITIATE`          | implemented — creates the real Telebirr order    |
| `PURCHASE_COMPLETE`          | implemented — verifies the callback signature    |
| `SMS_NOTIFICATION`           | implemented — sends through SMSEthiopia          |
| `WEBHOOK_PROCESS`            | gated — verifies the signature, cannot route yet |
| `DATA_EXPORT`                | gated — needs the `@abugida/database` write      |
| `BUNDLE_ENROLLMENT_CREATE`   | gated — needs the `@abugida/database` write      |
| `ENROLLMENT_PROGRESS_UPDATE` | gated — needs the `@abugida/database` write      |
| `MODERATION_SUBMIT`          | gated — needs the `@abugida/database` write      |
| `AUDIT_LOG`                  | gated — needs the `@abugida/database` write      |
| `RECALCULATE_STATS`          | gated — needs the `@abugida/database` write      |
| `AGGREGATE_METRICS`          | gated — needs the `@abugida/database` write      |
| `MAINTENANCE_TASK`           | gated — needs the `@abugida/database` write      |
| `DATA_RETENTION`             | gated — needs the `@abugida/database` write      |
| `EMAIL_NOTIFICATION`         | gated — no email delivery service is wired up    |

The rollout therefore starts with the queues whose processors are implemented and widens from there.

---

## Contract Drift Protection

The contract lives in `@abugida/queue`; the consumer lives here. Three mechanisms keep them in sync (ADR-028 §5):

1. **Type-level coverage** — the processor aggregate in `src/runtime/processors.ts` is typed `satisfies ProcessorEntries`. A missing job type, a processor that receives the wrong payload type, or a `queueName` that disagrees with `JOB_QUEUE_MAP` is a **compile error**.
2. **Contract-drift tests** — `tests/unit/contract-drift.test.ts` asserts that every job type has exactly one processor, that each processor runs on the queue `JOB_QUEUE_MAP` assigns, and that a fixture per job type passes `validateJobData`.
3. **Pre-push guardrail** — the husky `pre-push` hook runs `pnpm typecheck` across the workspace, so a contract change that breaks either side cannot be pushed.

### Payload evolution rules

- Payloads are **append-only**: new fields are optional and never change an existing field's type or meaning.
- A **breaking change means a new `JobType`**. The previous job type, its payload, its validator and its processor stay in place until the corresponding queue has drained — `removeOnComplete` retention means old jobs outlive deploys.
- Retiring a `JobType` is a separate, explicit step with its own deprecation note.

---

## Operations

```bash
just worker-up staging      # start the worker container (staging | prod)
just worker-down staging    # stop and remove it
just worker-logs staging    # tail its logs
just worker-dev             # run it locally against the dev infrastructure
just health-worker          # liveness + readiness
```

In development the worker runs as a local process (like the API and the dashboard): the dev compose tier is infrastructure-only, so `just dev-up` provides Redis and `just worker-dev` consumes it.

Scaling is horizontal — several instances may consume the same queues, and the BullMQ locks keep every job single-owner. `WORKER_REPLICAS` scales the prod tier; `WORKER_QUEUES` splits the queues between instances.

---

## Multi-Stage Dockerfile

`app/worker/Dockerfile` follows the shared three-stage layout:

1. **base** — `oven/bun:1.4.4-alpine` pinned by digest, with bash, curl and jq, and the non-root `appuser` (uid/gid 1000).
2. **builder** — a workspace-aware `pnpm install --filter @abugida/worker...` against the frozen lockfile, the two shared workspace packages (`@abugida/queue`, `@abugida/observability`) compiled to `dist/`, and a single-file Bun bundle (`bun build --target bun`).
3. **runtime** — the base stage plus the bundle, the entrypoint and the healthcheck. No `node_modules`, no lockfile and no build tooling ship with the image.

The entrypoint waits for Redis, fetches the Vault secrets in production, and then `exec`s the worker as PID 1 so `SIGTERM` reaches it directly. The worker drains in-flight jobs on shutdown before closing the connections and flushing telemetry.

---

## Related

- ADR-028 — the split of `@abugida/queue` into a contract package and this work app
- [api.md](api.md) — the producer that fills the queues
- [redis.md](redis.md) — the queue store
- `@abugida/queue` — the shared job contract and producer runtime
