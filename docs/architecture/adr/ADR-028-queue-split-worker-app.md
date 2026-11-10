# ADR-028: Split `@abugida/queue` — move the consumer runtime and processors into the `app/worker` work app

## Status

Proposed

## Context

`packages/queue` (`@abugida/queue`) is the shared BullMQ-over-Redis layer for the whole monorepo. It bundles three distinct concerns behind one entry point:

1. **Contract and producer** — the `JobType` enum (14 job types), the `JobDataMap` payload interfaces, `QUEUE_NAMES` (9 queues), `JOB_QUEUE_MAP`/`JOB_PRIORITY_MAP`/`DEFAULT_QUEUE_OPTIONS`, payload validators, the `QueueError` hierarchy, `createQueueClient`, Redis connection helpers, configuration (`mergeWithDefaults`/`getDefaultConfig`), and the Hono/TanStack **producer** middleware.
2. **Consumer runtime** — `createQueueWorker`, `ProcessorRegistry`, the `middleware/*/worker` helpers, and the nine processor modules aggregated by `allProcessors`.
3. **Domain integrations** — Telebirr and SMSEthiopia clients plus the shared HTTP/error model, consumed only by processors.

An inventory of actual imports across the workspace (verified at decision time):

| Consumer                                                                                                  | Imports                                                                                                | Side     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `app/api`                                                                                                 | `QueueClient`, `JobType`, `createConnection` (rate limiting), `mergeWithDefaults`, `createQueueClient` | producer |
| `app/dashboard`                                                                                           | `@abugida/queue/tanstack` client, `JobType`, `mergeWithDefaults`, `enqueueBulk`                        | producer |
| `app/marketing`                                                                                           | —                                                                                                      | none     |
| Anything outside the package using `createQueueWorker`, `allProcessors`, or `@abugida/queue/integrations` | none                                                                                                   | —        |

Three facts frame this decision:

- **Nothing consumes jobs today.** The API and the dashboard enqueue jobs (exports, webhooks, enrollment progress, emails) into Redis, but no app, script, or Compose service runs a worker — jobs accumulate unprocessed. The missing consumer is an operational gap, not just a packaging concern.
- **The consumer surface has no workspace users.** Removing it from the shared package is a compile-time-verifiable move: workspace-wide `pnpm typecheck` (also the `pre-push` hook) proves no import breaks. `knip` covers the remaining unused-export surface.
- **The consumer half does not belong in a library every app imports.** The processors carry their `@abugida/database` integration only as TODO comments, the `TELEBIRR_*`/`SMSETHIOPIA_*` secrets are read from the environment inside a library that `app/api`, `app/dashboard`, and every future app depend on, and any app importing the package inherits a consumer surface it will never run. Root `AGENTS.md` states that apps own their runtimes and packages hold shared logic; the consumer half of this package violates that line.

Two further facts shape _how_ the split is done rather than _whether_ it is done:

- **The processors are stubs.** Apart from `purchase` and `webhook`, every processor logs and returns a placeholder result with its database write still a TODO. Enabling a worker today therefore consumes and completes queued jobs without performing their work — see Risks.
- **The package is Bun-bound, not framework-bound.** `core/connection.ts` uses Bun's native `RedisClient` (`import { RedisClient } from 'bun'`), so `app/dashboard`'s Vite config must keep externalising the package. "Framework-agnostic" here means "no Hono/TanStack imports", not "runtime-portable".

## Decision

### 1. Two artifacts, one direction

| Artifact                | Name                                | Contains                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared contract package | `@abugida/queue` (`packages/queue`) | The job contract (job types, payloads, queue names, maps, priorities, validators, error hierarchy) and the producer runtime: `createQueueClient`/`QueueClient`, Redis connection helpers, configuration schema and defaults. Framework **producer** adapters stay as subpath exports (`/hono`, `/tanstack`). |
| Work app                | `app/worker` → `@abugida/worker`    | The process that runs jobs: worker runtime (`createQueueWorker`), processor registry and the nine processor modules, Telebirr/SMSEthiopia integrations, execution-time idempotency and error classification, health endpoints, graceful shutdown. Depends on `@abugida/queue`.                               |

Dependency direction is one-way: **`app/worker` → `@abugida/queue`**. The shared package never imports the app. The work app declares its own third-party dependencies: `BullMQ` (the same range as the package, kept aligned by `syncpack`; the two live in different processes, so a second installed copy is harmless) and, once the processor TODOs land, `@abugida/database`.

**The package keeps its name.** The rename to `@abugida/producer` was considered and rejected: the package is not producer-only — it owns the _contract_ (`JobType`, `JobDataMap`, `QUEUE_NAMES`, `JOB_QUEUE_MAP`) that the worker also imports, so "producer" would misdescribe it. Keeping `@abugida/queue` also avoids churn across `app/api`, `app/dashboard`, `app/dashboard/vite.config.ts`, `app/dashboard/AGENTS.md`, `knip.config.js`, the root `AGENTS.md` tables, and the package's published name (`"private": false`, `files: ["dist", "README.md"]`), none of which buys functional value.

**The framework producer adapters stay in the package.** `middleware/hono/client.ts` and `middleware/tanstack/client.ts` remain as the `/hono` and `/tanstack` subpath exports, with `hono` and `@tanstack/react-start` remaining optional peers. This matches the established convention in this repository: `packages/auth` exports `/hono`, `/tanstack`, `/client`; `packages/observability` exports `/hono`, `/tanstack`, `/astro`. Each adapter has exactly one consumer today, but the alternative — two bespoke copies, one per app — duplicates the client lifecycle (and the dashboard's singleton plus its `close()` path) for no gain. Only the **consumer-side** middleware (`middleware/{hono,tanstack}/worker.ts`) leaves the package, because it is bound to the processor set.

**Removed from the shared package:** the `/integrations` subpath, `createQueueWorker`, `allProcessors` and the individual processor exports, `ProcessorRegistry`, the worker middleware, `createQueueSystem`, and the execution-time helpers listed in §2. Nothing re-exports them; the work app owns them outright.

### 2. Module allocation

| Current module                                            | Destination    | Rationale                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/types.ts`                                           | split          | Contract half stays (`JobType`, payloads, `JobDataMap`, `QueueClient`, `EnqueueOptions`, the `QueueError` hierarchy); consumer half moves (`JobProcessor`, `ProcessorEntry`, `AnyProcessorEntry`, `ProcessorAdapter`, `QueueWorker`, `QueueFactory`, `IdempotencyRecord`). |
| `core/client.ts`                                          | shared package | Producer runtime.                                                                                                                                                                                                                                                          |
| `core/connection.ts`                                      | shared package | Producer + connection are shared — `app/api` already uses `createConnection(..., 'rate-limit')`.                                                                                                                                                                           |
| `core/worker.ts`                                          | work app       | Consumer runtime.                                                                                                                                                                                                                                                          |
| `definitions/jobs.ts`, `definitions/queues.ts`            | shared package | Contract — both sides read `JOB_QUEUE_MAP`, `JOB_PRIORITY_MAP` and `DEFAULT_QUEUE_OPTIONS`.                                                                                                                                                                                |
| `definitions/processors.ts`                               | work app       | Consumer-only registry.                                                                                                                                                                                                                                                    |
| `config/schema.ts`, `config/defaults.ts`                  | shared package | Configuration vocabulary (`QueueConfig`, `mergeWithDefaults`, `getDefaultConfig`).                                                                                                                                                                                         |
| `config/env.ts`                                           | work app       | `process.env` readers (`getAppName`, `getWorkerId`, `requireEnv`, `detectEnvironment`) are runtime concerns, and `getWorkerId` is worker-only. `app/api` already owns its own env → config mapping in `app/api/src/config/queue.ts`.                                       |
| `utils/validators.ts`                                     | shared package | Contract validation — the payload shape is part of the contract and is checked at enqueue and at consume time.                                                                                                                                                             |
| `utils/errors.ts`                                         | work app       | `classifyError`/`safeErrorMessage` classify _processing_ failures for retry decisions; the contract error hierarchy stays in the package.                                                                                                                                  |
| `utils/logger.ts`                                         | work app       | Every consumer of `getLogger()` is a processor, and the work app composes logging from `@abugida/observability` (pino) — a second logger in the shared package would ship unused.                                                                                          |
| `utils/idempotency.ts`                                    | work app       | `SET NX EX` locks and cached results are execution-time dedupe, used by processors. Producer-only apps never call them.                                                                                                                                                    |
| `processors/*` (9 modules + aggregate)                    | work app       | Business logic — the right home for the `@abugida/database` TODOs.                                                                                                                                                                                                         |
| `integrations/*`                                          | work app       | Only processors use Telebirr/SMSEthiopia; the secrets move to the only process that needs them.                                                                                                                                                                            |
| `middleware/hono/client.ts`                               | shared package | Stays as the `/hono` subpath export (optional `hono` peer).                                                                                                                                                                                                                |
| `middleware/tanstack/client.ts`                           | shared package | Stays as the `/tanstack` subpath export (optional `@tanstack/react-start` peer).                                                                                                                                                                                           |
| `middleware/{hono,tanstack}/worker.ts`                    | work app       | Consumer side; both wrappers are a few lines and collapse into the bootstrap.                                                                                                                                                                                              |
| `createQueueSystem` factory + `QueueFactory` type         | removed        | No consumer exists (`knip`), and the factory's `createWorker` member returns the consumer-only `QueueWorker` type — it cannot survive the split in either form.                                                                                                            |
| Tests (`worker`, `processors`, `telebirr`, `smsethiopia`) | work app       | Moved alongside their code, never deleted; producer-side tests stay in the package.                                                                                                                                                                                        |
| Worker examples (`examples/*/worker.ts`)                  | work app       | Replaced in the package README by a pointer to the real app.                                                                                                                                                                                                               |
| Package manifest (`exports`)                              | shared package | Drop the `/integrations` export; `.`, `./core` (contract types), `./hono` and `./tanstack` remain.                                                                                                                                                                         |

### 3. Removed exports

`createQueueWorker`, `allProcessors` and the per-domain processor exports, `ProcessorRegistry`, `getProcessorsForQueue`/`getProcessorForJobType`, the worker middleware, `createQueueSystem`/`QueueFactory`, the integration exports, the `/integrations` subpath, and the execution-time helpers (`utils/errors.ts`, `utils/idempotency.ts`, `utils/logger.ts`, `config/env.ts`) leave the package outright — they move into `app/worker`, and nothing re-exports them.

No workspace code imports them today. `pnpm typecheck` and `knip` in PR B prove it. Before landing, the package's npm publication state is confirmed (`npm view @abugida/queue`); if the package has been published to a public registry, the removed surface is additionally handled as a major-version bump rather than a silent removal.

### 4. Work app shape

```text
app/worker/
├── .env.example         # REDIS_*, TELEBIRR_*, SMSETHIOPIA_*, NODE_ENV, LOG_LEVEL, APP_NAME, WORKER_QUEUES
├── package.json         # "private": true, like every other app workspace
├── src/
│   ├── index.ts         # env → config → processors → start → graceful shutdown
│   ├── config/          # zod env schema + env → QueueConfig (mergeWithDefaults)
│   ├── runtime/         # worker.ts, registry.ts, processors.ts (aggregate), health.ts, shutdown.ts
│   ├── processors/      # the nine modules, moved as-is
│   └── integrations/    # Telebirr, SMSEthiopia, HTTP/error model, moved as-is
└── tests/               # moved unit + Redis-gated integration tests, plus contract-drift tests
```

- **Queue selection:** `WORKER_QUEUES=all` (default) or a CSV of full queue names (e.g. `abugida.purchases,abugida.webhooks`) — the package's existing selective-worker capability becomes an ops feature, and a per-queue rollout is also the mechanism that gates the stub processors (see Risks).
- **Health:** a small Hono server exposing `/health` (process liveness) and `/health/ready` (Redis reachable + expected workers started), wired into the Compose healthcheck — BullMQ workers are otherwise headless. The paths match the existing convention in `app/api/src/modules/system/system.routes.ts` and the Compose healthchecks in `docker/compose/app.yml`. This Hono usage is app-local: the work app owns its runtime, so it does not contradict the package's framework boundary.
- **Runtime:** plain Bun (ADR-001, ADR-027), no bundler, so the dashboard's Vite externalisation of the shared package does not apply here.
- **Logging/tracing:** composed from `@abugida/observability`, so jobs emit the same pino/OpenTelemetry signals as the apps. The package's bespoke `utils/logger.ts` is not carried over.

### 5. Contract governance (drift prevention)

1. **Single source** — `JobType`, `JobDataMap`, `QUEUE_NAMES`, `JOB_QUEUE_MAP`, `JOB_PRIORITY_MAP` exist only in `@abugida/queue`; the work app imports them, never re-declares them.
2. **Type-level coverage on both sides** — the package already enforces validator coverage type-level (`Record<JobType, ValidatorFn>` in `utils/validators.ts`). The work app adds the matching guarantee for processors: the aggregate is typed so that a missing or extra processor is a compile error, and each processor's `queueName` is typed against `JOB_QUEUE_MAP[jobType]` rather than `string`.

   ```ts
   // app/worker/src/runtime/processors.ts
   export const processors = {
     [JobType.PURCHASE_INITIATE]: {
       jobType: JobType.PURCHASE_INITIATE,
       processor: processPurchaseInitiate,
       queueName: QUEUE_NAMES.PURCHASES,
     },
     // …one entry per JobType…
   } satisfies Record<JobType, ProcessorEntry>
   ```

   Adding a `JobType` to the contract therefore breaks the work app's typecheck, and a processor whose queue does not match `JOB_QUEUE_MAP` breaks it too.

3. **Contract-drift tests in the work app** — every `JobType` has exactly one processor; every processor's `queueName` equals `JOB_QUEUE_MAP[jobType]`; fixtures pass `validateJobData`.
4. **Payload evolution rules** (documented in both READMEs) — payloads are append-only with optional fields; a breaking change means a **new `JobType`**. The previous `JobType`, its payload type, its validator and its processor all stay in place until the corresponding queue has drained, because `removeOnComplete` retention means old jobs outlive deploys. Retiring a `JobType` is a separate, explicit step with its own deprecation note.
5. **Tenant context** — payloads that address tenant-scoped data carry an optional `tenantId`, added before the worker is enabled. The job contract is the only place a worker can learn which tenant a job belongs to, and appending an optional field now is cheaper than a second payload version later.
6. **Pre-push guardrail** — the husky `pre-push` → `pnpm typecheck` fan-out prevents pushing a contract change that breaks either side.

### 6. Unchanged behaviour

Queue names (`abugida.*`), job names, payload shapes, priorities and retry/backoff defaults; the Redis topology and the jobs already queued; what producers enqueue. The only changes for `app/api` and `app/dashboard` are none at all — their import paths stay exactly as they are, because the producer surface and its framework subpaths are preserved. Deployment of the work app therefore requires **no data migration**: the worker starts consuming queues that already exist.

### 7. Sequencing

The sequence deliberately lands the operational value first and the structural cleanup afterwards, so the largest diff is never also the risky deploy.

- **PR A — stand up the consumer (small, high value):** scaffold `app/worker` (`private: true`, `bunfig.toml` preload, tsconfig/eslint/prettier, `.env.example`) and have it consume the _current_ `@abugida/queue` exports — `createQueueWorker` + `allProcessors` — with env/config composition, `WORKER_QUEUES`, health endpoints and graceful shutdown. This closes "no consumer exists" in a small, revertible change and lets the rollout be rehearsed against dev infra (`just dev-up`).
- **PR B — move the consumer half:** `git mv` the consumer modules per §2 into `app/worker`; split `core/types.ts`; delete the removed exports and the `/integrations` subpath from the package; move the tests and examples. The package's producer surface and its `/hono` and `/tanstack` subpaths are untouched, so `app/api` and `app/dashboard` need no changes.
- **PR C — infrastructure and docs:** Compose service per `docs/configuration/adding-a-service.md` with healthcheck and tier profiles, `just` recipes (`worker-up`/`worker-down`, `logs worker`, included in `health`), `docs/services/worker.md`, root `AGENTS.md` app table, `knip.config.js` workspace entries, package README.
- **Follow-ups (separate track):** implement the processors' `@abugida/database` TODOs in their new home; optional `assertJobData` on enqueue; per-queue rollout (staging → prod).

Verification for every PR: `pnpm typecheck && pnpm lint && pnpm test` inside the devbox, plus `pnpm knip`.

### 8. Checklist for the structural change (PR B)

Items that are not caught by `tsc` and must be swept explicitly:

- `app/dashboard/vite.config.ts` — the package stays externalised (it pulls Bun's native Redis client) but the entry name must track the package name if it ever changes; the `/tanstack` subpath import path must keep resolving.
- `knip.config.js` — the `packages/queue` workspace entry and its `ignoreDependencies: ['hono']` exception (the optional `hono` peer remains, so the exception stays valid).
- `app/dashboard/AGENTS.md` and the root `AGENTS.md` shared-package table — the subpath list must still describe what exists.
- `packages/queue/README.md` — installation, subpaths and the worker examples.
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` — `app/*` already covers the new workspace.

## Consequences

### Positive

- Apps depend only on the surface they use: a thin, single-source job contract plus a producer runtime with a single framework boundary (optional-peer subpaths, as `packages/auth` and `packages/observability` already do).
- The monorepo gains its first actual job consumer — queued exports, webhooks, enrollment and email jobs start draining, and job processing becomes independently deployable and scalable (`--scale worker=N`, per-queue instances via `WORKER_QUEUES`).
- Contract drift between producers and the consumer becomes a compile-time failure instead of a runtime surprise, enforced by the typed processor aggregate, the drift tests and the pre-push typecheck.
- Processors get a natural home for the `@abugida/database` transactions their TODOs specify, and future apps enqueue jobs by importing `@abugida/queue` alone.
- The `TELEBIRR_*`/`SMSETHIOPIA_*` secrets leave a library that every app imports and live only in the process that calls those APIs.

### Negative

- Two workspaces must be kept in lockstep: a contract change requires touching both the package and (if job types change) the work app's processors — mitigated by the governance rules, but it is now two reviews instead of one.
- Generic worker infrastructure (`createQueueWorker` and friends) lives in an app rather than a package; if a second worker process ever appears it will be extracted (the modules sit isolated in `src/runtime/` to keep that a `git mv`).
- The work app owns its own logging, error classification and idempotency helpers instead of reusing them from the shared package — more code in the app, but no unused surface in the library.
- `BullMQ` is declared in two manifests (kept to one installed copy by identical ranges + `syncpack`).

### Risks

- **Enabling a worker while processors are stubs consumes queued work without performing it.** `DATA_EXPORT`, `AUDIT_LOG`, `RECALCULATE_STATS`, `MODERATION_SUBMIT`, `BUNDLE_ENROLLMENT_CREATE`, `ENROLLMENT_PROGRESS_UPDATE`, `MAINTENANCE_TASK` and `DATA_RETENTION` currently log a placeholder and return; `WEBHOOK_PROCESS` still has its routing to `PURCHASE_COMPLETE` as a TODO; `PURCHASE_INITIATE` calls the real Telebirr API. Jobs already queued would be completed and then removed by `removeOnComplete`, destroying work that is today at least still sitting in Redis. Mitigation, and a hard gate before the worker is enabled outside development: every unimplemented processor throws `UnrecoverableError` instead of returning success; the existing backlog is triaged explicitly (`getJobCounts` per queue) before any consumer starts; the rollout begins with `WORKER_QUEUES` restricted to queues whose processors are implemented, one queue at a time.
- **Worker not deployed** leaves the status quo (jobs queue unprocessed) rather than losing data; the rollout runbook must treat "queues draining" as the post-deploy verification signal, and "no queue draining" as the signal to stop.
- **Missed consumer of a removed export or an old import path** — none exist today; workspace-wide typecheck and `knip` in PR B prove it. The npm publication state of `@abugida/queue` is checked before the removals land (see §3).
- **Silent breakage outside the type system** — the Vite external list, `knip.config.js`, the `AGENTS.md` tables and the READMEs are string references that `tsc` does not check; §8 lists them explicitly.
- **Integrations later needed outside the worker** (e.g. signature verification at an API webhook ingress) — until then this is deliberate YAGNI; the boundary is one `git mv` from becoming `@abugida/jobs`.
- **Version drift between the producer's and the worker's `BullMQ`** — `lint:deps` (syncpack) blocks the drift, and the two live in separate processes, so a divergence cannot cause a runtime class-identity failure.

## References

- Shared-package inventory and application boundaries: root `AGENTS.md`
- Subpath-export convention for framework adapters: `packages/auth` (`/hono`, `/tanstack`, `/client`), `packages/observability` (`/hono`, `/tanstack`, `/astro`)
- Current package surface: `packages/queue/README.md`
- Bun runtime: ADR-001, ADR-027
- Just recipes (to gain `worker-*`): ADR-009, ADR-021, `docs/development/writing-just-recipes.md`
- Redis (queues live on Redis Sentinel): ADR-014, `docs/services/redis.md`
- Modular Compose (where the worker service is added): ADR-024, `docs/configuration/adding-a-service.md`
- Health model and blue-green deploys: ADR-008, `docs/architecture/deployment-model.md`
