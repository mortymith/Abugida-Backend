# @abugida/queue

The **job contract** and the **producer runtime** of the [Abugida Application](https://github.com/abugida/abugida-app)
monorepo: a typed, BullMQ-based background job system on top of Redis, used by the **Hono API**
and the **TanStack Start dashboard** to enqueue work.

The consumer — the BullMQ worker, the processors and the provider integrations — lives in
`app/worker` (`@abugida/worker`). The split is one-way: the worker depends on this package, never
the other way round (ADR-028).

## Features

- **Typed job payloads** — a `JobType` enum plus a `JobDataMap` discriminated union, so the payload
  for a given job type is checked at compile time
- **Nine named queues** — declared once in `QUEUE_NAMES` with per-queue concurrency, rate limits,
  retry attempts, and backoff
- **One source of truth** — the job types, the payloads, the queue names and the maps exist only
  here; the worker imports them and never re-declares them
- **Runtime validation** — `validateJobData` / `assertJobData` guard every payload, at enqueue and
  at consume time
- **Typed errors** — the `QueueError` hierarchy distinguishes validation failures, exhausted jobs,
  duplicates and Redis outages
- **Hono integration** — context-injecting producer middleware
- **TanStack Start integration** — singleton producer client for server functions
- **Bun optimized** — Redis access via Bun's native `RedisClient` (`createBunRedisClient`), so no
  `ioredis` dependency

## Installation

```bash
pnpm add @abugida/queue
```

Requires a reachable Redis (or Redis Sentinel) instance. `hono` and `@tanstack/react-start` are
optional peer dependencies — install them only if you use the corresponding subpath.

## Quick Start

```typescript
import { createQueueClient, mergeWithDefaults, JobType } from '@abugida/queue'

const config = mergeWithDefaults({
  redis: { hostname: 'localhost', port: 6379 },
})

const client = createQueueClient(config)

const jobId = await client.enqueue(JobType.PURCHASE_INITIATE, {
  userId: 'user-1',
  courseId: 'course-1',
  amount: 500,
  currency: 'ETB',
  paymentMethod: 'telebirr',
  idempotencyKey: 'purchase:user-1:course-1',
})

await client.close()
```

## Entry Points

| Subpath                   | Contents                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `@abugida/queue`          | The contract and the producer runtime: client, definitions, config, validators      |
| `@abugida/queue/core`     | Contract types and errors (`JobType`, `JobDataMap`, `QueueClient`, `QueueError`, …) |
| `@abugida/queue/hono`     | Hono producer client + `createQueueMiddleware`                                      |
| `@abugida/queue/tanstack` | TanStack Start singleton producer client                                            |

`./core` resolves to the `core/types` module — it is a types-and-errors surface, not a runtime
entry point. The former `/integrations` subpath (Telebirr, SMSEthiopia) and every consumer export
(`createQueueWorker`, `allProcessors`, `ProcessorRegistry`, the worker middleware) left the
package in ADR-028; the worker app owns them now.

## Configuration

`mergeWithDefaults(overrides, env?)` deep-merges your overrides onto environment defaults. `env`
defaults to `'development'`.

```typescript
import { mergeWithDefaults, type QueueConfig } from '@abugida/queue'

const config: QueueConfig = mergeWithDefaults(
  {
    env: 'production',
    redis: {
      hostname: 'redis.internal',
      port: 6379,
      username: 'abugida',
      password: process.env.REDIS_PASSWORD,
      db: 0,
      tls: true,
      connectionTimeout: 10_000,
      autoReconnect: true,
      maxRetries: 10,
    },
    queues: {
      // Override any queue declared in QUEUE_NAMES
      'abugida.notifications': {
        concurrency: 20,
        limiter: { max: 200, duration: 60_000 },
        defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } },
      },
    },
    logging: { level: 'info', format: 'json' },
  },
  'production',
)
```

### Environment Variables

`getDefaultConfig` reads these when the matching field is not overridden:

| Variable         | Used for                        |
| ---------------- | ------------------------------- |
| `REDIS_HOST`     | `redis.hostname` (staging/prod) |
| `REDIS_PORT`     | `redis.port`                    |
| `REDIS_USERNAME` | `redis.username` (ACL auth)     |
| `REDIS_PASSWORD` | `redis.password`                |
| `REDIS_DB`       | `redis.db`                      |

The environment label is a parameter (`mergeWithDefaults(overrides, 'production')`), not an
environment variable. TLS is enabled automatically when `env === 'production'`.

## Queues

```typescript
import {
  QUEUE_NAMES,
  getAllQueueNames,
  PRIORITY,
  JOB_QUEUE_MAP,
  JOB_PRIORITY_MAP,
} from '@abugida/queue'

QUEUE_NAMES.PURCHASES // 'abugida.purchases'
QUEUE_NAMES.ENROLLMENTS // 'abugida.enrollments'
QUEUE_NAMES.NOTIFICATIONS // 'abugida.notifications'
QUEUE_NAMES.EXPORTS // 'abugida.exports'
QUEUE_NAMES.WEBHOOKS // 'abugida.webhooks'
QUEUE_NAMES.MODERATION // 'abugida.moderation'
QUEUE_NAMES.STATISTICS // 'abugida.statistics'
QUEUE_NAMES.AUDIT // 'abugida.audit'
QUEUE_NAMES.MAINTENANCE // 'abugida.maintenance'

getAllQueueNames() // all nine names
JOB_QUEUE_MAP[JobType.WEBHOOK_PROCESS] // owning queue for a job type
JOB_PRIORITY_MAP[JobType.PURCHASE_INITIATE] // PRIORITY.HIGH
```

Lower `PRIORITY` numbers win in BullMQ: `HIGH: 1`, `MEDIUM: 5`, `LOW: 10`.

`JOB_QUEUE_MAP` is declared `as const satisfies Record<JobType, string>`, so the literal queue name
of a job type survives into the consumer: the worker can only register a processor under the queue
the job type actually belongs to.

## Job Types

| Job Type                     | Queue           | Payload                           |
| ---------------------------- | --------------- | --------------------------------- |
| `PURCHASE_INITIATE`          | `purchases`     | `PurchaseInitiateJobData`         |
| `PURCHASE_COMPLETE`          | `purchases`     | `PurchaseCompleteJobData`         |
| `BUNDLE_ENROLLMENT_CREATE`   | `enrollments`   | `BundleEnrollmentCreateJobData`   |
| `ENROLLMENT_PROGRESS_UPDATE` | `enrollments`   | `EnrollmentProgressUpdateJobData` |
| `DATA_EXPORT`                | `exports`       | `DataExportJobData`               |
| `WEBHOOK_PROCESS`            | `webhooks`      | `WebhookProcessJobData`           |
| `SMS_NOTIFICATION`           | `notifications` | `SmsNotificationJobData`          |
| `EMAIL_NOTIFICATION`         | `notifications` | `EmailNotificationJobData`        |
| `MODERATION_SUBMIT`          | `moderation`    | `ModerationSubmitJobData`         |
| `RECALCULATE_STATS`          | `statistics`    | `RecalculateStatsJobData`         |
| `AGGREGATE_METRICS`          | `statistics`    | `AggregateMetricsJobData`         |
| `AUDIT_LOG`                  | `audit`         | `AuditLogJobData`                 |
| `MAINTENANCE_TASK`           | `maintenance`   | `MaintenanceTaskJobData`          |
| `DATA_RETENTION`             | `maintenance`   | `DataRetentionJobData`            |

Every payload carries an `idempotencyKey` used by the worker to de-duplicate retries, and the
payloads that address tenant-scoped data carry an optional `tenantId`.

### Payload evolution rules

The job contract is append-only. Both this README and the worker app's README document the same
rules (ADR-028 §5.4):

- Payloads grow with **optional** fields only; an existing field never changes its type or meaning.
- A **breaking change means a new `JobType`**. The previous job type, its payload type, its
  validator and its processor all stay in place until the corresponding queue has drained, because
  `removeOnComplete` retention means old jobs outlive deploys.
- Retiring a `JobType` is a separate, explicit step with its own deprecation note.

Adding a `JobType` here breaks the worker's typecheck until the new job type has a processor — the
contract is guarded on both sides.

## Producing Jobs

```typescript
import { createQueueClient, JobType } from '@abugida/queue'

const client = createQueueClient(config)

// Single job
const jobId = await client.enqueue(JobType.DATA_EXPORT, {
  userId: 'user-1',
  format: 'json',
  requestedAt: new Date().toISOString(),
  idempotencyKey: `export:user-1:${Date.now()}`,
})

// Per-job overrides: priority, delay, custom jobId, retention, backoff
await client.enqueue(
  JobType.SMS_NOTIFICATION,
  { recipientPhone: '+251911000000', message: 'Hi', idempotencyKey: 'sms:1' },
  { priority: 1, delay: 5_000, jobId: 'sms-1', removeOnComplete: true },
)

// Bulk — grouped per queue and added in a single round trip
const jobIds = await client.enqueueBulk([
  {
    jobType: JobType.SMS_NOTIFICATION,
    data: { recipientPhone: '+25191…', message: 'A', idempotencyKey: 'a' },
  },
  {
    jobType: JobType.SMS_NOTIFICATION,
    data: { recipientPhone: '+25191…', message: 'B', idempotencyKey: 'b' },
  },
])

// Introspection
await client.getQueueLength(QUEUE_NAMES.PURCHASES) // waiting + active + delayed
await client.getJobCounts(QUEUE_NAMES.PURCHASES) // waiting/active/completed/failed/delayed

await client.close()
```

## Consuming Jobs

Consuming is the worker's job, not this package's. The worker runtime (`createQueueWorker`), the
processor registry, the nine processor modules, the idempotency helpers and the Telebirr /
SMSEthiopia integrations live in `app/worker` — see `app/worker/README.md` and
`docs/services/worker.md`.

The package keeps the contract the consumer needs: the job types, the payloads, the queue map and
the validators.

## Validation

```typescript
import { validateJobData, assertJobData, JobType } from '@abugida/queue'

const result = validateJobData(JobType.PURCHASE_INITIATE, payload)
// { valid: true, errors: [] }

assertJobData(JobType.PURCHASE_INITIATE, payload) // throws JobValidationError
```

The validators are typed as a `Record<JobType, ValidatorFn>`, so a new job type without a validator
is a compile error.

## Error Handling

All queue errors extend `QueueError`:

```typescript
import {
  QueueError,
  JobExhaustedError,
  DuplicateJobError,
  RedisConnectionError,
  JobValidationError,
} from '@abugida/queue'

try {
  await client.enqueue(JobType.DATA_EXPORT, payload)
} catch (error) {
  if (error instanceof RedisConnectionError) {
    // Redis unreachable — inspect `error.endpoint`
  } else if (error instanceof JobValidationError) {
    // inspect `error.errors`
  } else if (error instanceof DuplicateJobError) {
    // inspect `error.idempotencyKey`
  }
}
```

## Hono Integration

```typescript
import { Hono } from 'hono'
import { createQueueMiddleware, type HonoQueueContext } from '@abugida/queue/hono'

const app = new Hono<{ Variables: HonoQueueContext }>()
app.use('*', createQueueMiddleware(config))

app.post('/api/webhooks/telebirr', async (c) => {
  const queue = c.get('queue')
  const jobId = await queue.enqueue('WEBHOOK_PROCESS', {
    source: 'telebirr',
    payload: await c.req.json(),
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    idempotencyKey: `webhook:telebirr:${Date.now()}`,
  })
  return c.json({ jobId, status: 'queued' }, 202)
})
```

`createHonoQueueClient(config)` returns a standalone client if you would rather not use the
context.

## TanStack Start Integration

```typescript
// Server function / API route
import { getTanStackQueueClient, closeTanStackQueueClient } from '@abugida/queue/tanstack'

export async function requestExport(userId: string) {
  const queue = getTanStackQueueClient(config)
  return queue.enqueue('DATA_EXPORT', {
    userId,
    format: 'json',
    requestedAt: new Date().toISOString(),
    idempotencyKey: `export:${userId}:${Date.now()}`,
  })
}
```

`getTanStackQueueClient` memoises a singleton; `createTanStackQueueClient` always builds a fresh
one (useful in tests), and `closeTanStackQueueClient` tears the singleton down at shutdown.

## Redis Connections

```typescript
import {
  createConnection,
  createBullMQConnection,
  closeConnection,
  closeAllConnections,
} from '@abugida/queue'

const raw = createConnection(config, 'custom') // Bun RedisClient
const bull = createBullMQConnection(config, 'custom') // ioredis-compatible adapter

await closeConnection(config, 'custom')
await closeAllConnections()
```

Connections are cached per purpose (`producer`, `consumer:<queue>`, …) and reused. BullMQ is fed
Bun's native client through `createBunRedisClient`, so no `ioredis` dependency is pulled in.

## Testing

```bash
# All tests
pnpm run test

# Unit only
pnpm run test:unit

# Integration (skipped unless a Redis instance is reachable)
pnpm run test:integration
```

## Development

```bash
pnpm run build       # tsc → dist/
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # eslint
pnpm run format      # prettier
```

Runnable producer examples live in `examples/hono` and `examples/tanstack`. The consumer examples
moved to `app/worker` with the consumer runtime.

## License

MIT
