# @abugida/worker

The **background job worker** of the Abugida Application monorepo: the process that drains the
BullMQ queues the API and the dashboard fill.

It owns the consumer half of the queue system (ADR-028):

- the BullMQ worker runtime (`createQueueWorker`) and the processor registry,
- the nine processor modules (purchases, enrollments, exports, webhooks, notifications, moderation,
  statistics, audit, maintenance),
- the Telebirr and SMSEthiopia integrations — and therefore the `TELEBIRR_*` / `SMS_ETHIOPIA_*`
  secrets, which live in this process alone,
- the execution-time idempotency and error-classification helpers,
- the health endpoints and the graceful shutdown.

The **contract** and the **producer runtime** live in `@abugida/queue`. The dependency direction is
one-way: `app/worker` → `@abugida/queue`.

## Development

```bash
pnpm --filter @abugida/worker dev      # start the worker against the dev infrastructure
pnpm --filter @abugida/worker test     # unit + contract-drift tests
pnpm --filter @abugida/worker build    # tsc → dist/
pnpm --filter @abugida/worker typecheck
pnpm --filter @abugida/worker lint
```

The configuration lives in `.env` — copy `app/worker/.env.example` to `app/worker/.env` and fill in
the values. Every variable has a default, so the worker starts against a local Redis without any
configuration at all.

## Layout

```text
app/worker/
├── Dockerfile            # multi-stage image (bun build → single-file bundle)
├── entrypoint.sh         # waits for Redis, loads the Vault secrets, execs the worker
├── src/
│   ├── index.ts          # env → config → processors → worker → health → shutdown
│   ├── config/           # validated env (app_config), queue config, observability
│   ├── runtime/          # worker.ts, processors.ts (aggregate), registry.ts, health.ts, shutdown.ts
│   ├── processors/       # the nine processor modules
│   ├── integrations/     # Telebirr, SMSEthiopia, the shared HTTP/error model
│   └── utils/            # error classification, idempotency
└── tests/                # unit, contract-drift and Redis-gated integration tests
```

## Queue selection

`WORKER_QUEUES` is either `all` (every declared queue) or a comma-separated list of full queue
names:

```bash
WORKER_QUEUES=abugida.purchases,abugida.webhooks
```

An unknown queue name fails fast at start-up. The setting is the per-queue rollout gate: the queues
whose processors are implemented are enabled one at a time.

## Health

| Endpoint            | Meaning                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `GET /health`       | Liveness — the process is up. Never fails.                                  |
| `GET /health/ready` | Readiness — Redis is reachable and every expected queue worker has started. |

## Contract drift

The processor aggregate in `src/runtime/processors.ts` is typed `satisfies ProcessorEntries`: a
missing job type, a processor that receives the wrong payload type, or a `queueName` that disagrees
with `JOB_QUEUE_MAP` is a **compile error**. `tests/unit/contract-drift.test.ts` adds the runtime
half of the same guarantee.

Payloads are append-only; a breaking change means a new `JobType`. See
`packages/queue/README.md` and `docs/services/worker.md` for the full rules.

## Operations

```bash
just worker-up staging      # start the worker container (staging | prod)
just worker-down staging    # stop and remove it
just worker-logs staging    # tail its logs
just worker-dev             # run it locally against the dev infrastructure
just health-worker          # liveness + readiness
```

## License

MIT
