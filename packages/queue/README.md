# @abugida/queue

Shared message queue layer for the [Abugida Application](https://github.com/abugida/abugida-app)
monorepo. Provides a typed, BullMQ-based background job system on top of Redis, used by the
**Hono API**, the **TanStack Start dashboard**, and standalone worker processes.

## Features

- **Typed job payloads** — a `JobType` enum plus a `JobDataMap` discriminated union, so the payload
  for a given job type is checked at compile time
- **Producer/consumer split** — `createQueueClient` for enqueuing, `createQueueWorker` for consuming
- **Nine named queues** — declared once in `QUEUE_NAMES` with per-queue concurrency, rate limits,
  retry attempts, and backoff
- **Batteries-included processors** — `allProcessors` covers purchases, enrollments, exports,
  webhooks, notifications, moderation, statistics, audit, and maintenance
- **Selective workers** — `getProcessorsForQueue` / `getProcessorForJobType` let you run a
  dedicated worker per queue
- **Idempotency helpers** — Redis `SET NX EX` locks and cached results so webhook retries and
  duplicated requests never double-process
- **Runtime validation** — `validateJobData` / `assertJobData` guard every payload
- **Telebirr integration** — signed H5 C2B order creation, status queries, and callback
  verification (`SHA256WithRSA`)
- **SMSEthiopia integration** — MSISDN normalisation, multi-version send API, delivery receipts
- **Error classification** — integration errors are tagged retryable vs. permanent and mapped onto
  BullMQ's `UnrecoverableError` so hopeless jobs stop burning attempts
- **Hono integration** — context-injecting middleware for producer routes
- **TanStack Start integration** — singleton client for server functions
- **Bun optimized** — Redis access via Bun's native `RedisClient` (`createBunRedisClient`), so no
  `ioredis` dependency
- **Graceful shutdown** — `stop()` drains in-flight jobs; `setupGracefulShutdown` wires SIGTERM/SIGINT

## Installation

```bash
pnpm add @abugida/queue
```

Requires a reachable Redis (or Redis Sentinel) instance. `hono` and `@tanstack/react-start` are
optional peer dependencies — install them only if you use the corresponding subpath.

## Quick Start

```typescript
import { createQueueSystem, mergeWithDefaults, allProcessors, JobType } from '@abugida/queue'

const config = mergeWithDefaults({
  redis: { hostname: 'localhost', port: 6379 },
})

const queueSystem = createQueueSystem(config)

// ---- Producer ----
const client = queueSystem.createClient()
const jobId = await client.enqueue(JobType.PURCHASE_INITIATE, {
  userId: 'user-1',
  courseId: 'course-1',
  amount: 500,
  currency: 'ETB',
  paymentMethod: 'telebirr',
  idempotencyKey: 'purchase:user-1:course-1',
})

// ---- Consumer ----
const worker = queueSystem.createWorker(allProcessors)
await worker.start()

// ---- Shutdown ----
await worker.stop()
await queueSystem.shutdown()
```

`createQueueSystem` is a thin factory over the two building blocks; use them directly when you
only need one side of the system.

## Entry Points

| Subpath                       | Contents                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@abugida/queue`              | Everything: factory, client, worker, definitions, processors, config, utilities, integrations, framework helpers |
| `@abugida/queue/core`         | Core types (`JobType`, `JobDataMap`, `QueueClient`, `QueueWorker`, `QueueError`, …)                              |
| `@abugida/queue/integrations` | Telebirr and SMSEthiopia clients, HTTP helpers, shared error types                                               |
| `@abugida/queue/hono`         | Hono producer client + `createQueueMiddleware`                                                                   |
| `@abugida/queue/tanstack`     | TanStack Start singleton producer client                                                                         |

`./core` resolves to the `core/types` module — it is a types-and-errors surface, not a runtime
entry point. The worker helpers for both frameworks (`createHonoWorker`, `createTanStackWorker`,
`setupGracefulShutdown`) are re-exported from the root entry.

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

| Variable               | Used for                             |
| ---------------------- | ------------------------------------ |
| `REDIS_HOST`           | `redis.hostname` (staging/prod)      |
| `REDIS_PORT`           | `redis.port`                         |
| `REDIS_USERNAME`       | `redis.username` (ACL auth)          |
| `REDIS_PASSWORD`       | `redis.password`                     |
| `REDIS_DB`             | `redis.db`                           |
| `APP_NAME`             | Worker id prefix via `getWorkerId()` |
| `NODE_ENV` / `BUN_ENV` | `detectEnvironment()`                |

TLS is enabled automatically when `env === 'production'`.

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

Every payload carries an `idempotencyKey` used by the processors to de-duplicate retries.

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

```typescript
import {
  createQueueWorker,
  allProcessors,
  getProcessorsForQueue,
  QUEUE_NAMES,
} from '@abugida/queue'

// Everything
const worker = createQueueWorker(config, allProcessors)
await worker.start()

// Or a dedicated per-queue worker
const notifications = createQueueWorker(config, getProcessorsForQueue(QUEUE_NAMES.NOTIFICATIONS))

worker.isRunning() // boolean
await worker.stop() // drains in-flight jobs, then closes connections
```

Add processors before `start()`:

```typescript
const worker = createQueueWorker(config, allProcessors)
worker.registerProcessor({
  jobType: JobType.AUDIT_LOG,
  queueName: QUEUE_NAMES.AUDIT,
  concurrency: 1,
  processor: async (data) => {
    /* … */
  },
})
await worker.start()
```

Registering after `start()` throws — the worker has already dispatched.

### Retries

BullMQ owns retries. The package only supplies the configuration; there is no bespoke retry
wrapper. Per-queue defaults live in `DEFAULT_QUEUE_OPTIONS` (`attempts` + `backoff: { type, delay }`)
and can be overridden per queue or per job. Processors signal hopeless failures by throwing
BullMQ's `UnrecoverableError`, which stops retries immediately.

## Processors

`allProcessors` is the aggregate of every module's processor array. Individual arrays are exported
too, for selective registration:

```typescript
import {
  allProcessors,
  purchaseProcessors,
  enrollmentProcessors,
  exportProcessors,
  webhookProcessors,
  notificationProcessors,
  moderationProcessors,
  statisticsProcessors,
  auditProcessors,
  maintenanceProcessors,
  getProcessorsForQueue,
  getProcessorForJobType,
} from '@abugida/queue'
```

A custom processor is a plain `ProcessorEntry`:

```typescript
import type { ProcessorEntry, JobType } from '@abugida/queue'

const entry: ProcessorEntry<{ userId: string }> = {
  jobType: JobType.AUDIT_LOG,
  queueName: 'abugida.audit',
  concurrency: 1,
  processor: async (data, job) => {
    // data is strongly typed; job gives id, name, attemptsMade, timestamp
    return { ok: true, userId: data.userId }
  },
}
```

`ProcessorRegistry` is available for building your own registry (`register`, `registerAll`, `get`,
`getAll`, `has`, `getJobTypes`, `getByQueue`).

### Idempotency

Every helper takes a Bun `RedisClient` (from `createConnection`) as its first argument.

```typescript
import {
  processWithIdempotency,
  checkIdempotency,
  acquireProcessingLock,
  storeIdempotencyResult,
  markProcessingFailed,
  createConnection,
} from '@abugida/queue'

const redis = createConnection(config, 'idempotency')

// Lock → run → store in one call; returns the cached result on a replay
const result = await processWithIdempotency(redis, key, JobType.PURCHASE_COMPLETE, () => doWork())

// Or step by step
if (await checkIdempotency(redis, key)) return // already done
await acquireProcessingLock(redis, key, JobType.PURCHASE_COMPLETE) // throws DuplicateJobError
await storeIdempotencyResult(redis, key, JobType.PURCHASE_COMPLETE, result)
```

`acquireProcessingLock` claims the key with `SET NX EX` (5-minute lock TTL) and throws
`DuplicateJobError` if the job already completed. Completed results are cached for 24 hours.
`markProcessingFailed` releases the lock so the next attempt can retry.

### Validation

```typescript
import { validateJobData, assertJobData, JobType } from '@abugida/queue'

const result = validateJobData(JobType.PURCHASE_INITIATE, payload)
// { valid: true, errors: [] }

assertJobData(JobType.PURCHASE_INITIATE, payload) // throws JobValidationError
```

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

Helpers:

```typescript
import { classifyError, safeErrorMessage } from '@abugida/queue'

classifyError(new Error('ECONNREFUSED')) // 'connection'
classifyError(new Error('timeout exceeded')) // 'timeout'
safeErrorMessage(new Error('secret password leak')) // 'An internal error occurred'
```

`classifyError` matches the same `ECONNREFUSED` / `ECONNRESET` / `ETIMEDOUT` / `timeout` signals
that route failures to a retry category.

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
context. `createHonoWorker({ config, processors? })` from the root entry bundles a worker with a
Hono app for health-check routes.

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

Worker side (root entry):

```typescript
import { createTanStackWorker, setupGracefulShutdown, getProcessorsForQueue } from '@abugida/queue'

const worker = createTanStackWorker({
  config,
  processors: [
    ...getProcessorsForQueue('abugida.statistics'),
    ...getProcessorsForQueue('abugida.audit'),
  ],
})

setupGracefulShutdown(worker) // handles SIGTERM + SIGINT
await worker.start()
```

## Telebirr Integration

Telebirr H5 C2B payment gateway: order creation, status queries, and signed callback
verification using `SHA256WithRSA`.

```typescript
import {
  createTelebirrClient,
  getTelebirrClient,
  getTelebirrConfigFromEnv,
  getTelebirrVerificationKey,
  getTelebirrSignaturePadding,
  buildStringToSign,
  signPayload,
  verifyPayload,
  TelebirrError,
  SIGN_TYPE,
  TELEBIRR_TESTBED_BASE_URL,
  TELEBIRR_PRODUCTION_BASE_URL,
} from '@abugida/queue/integrations'

const client = getTelebirrClient() // configured from TELEBIRR_* env vars

// Create a prepay order, then assemble the hosted checkout URL
const order = await client.createOrder({
  merchOrderId: 'order-1',
  title: 'Course purchase',
  amount: 500,
  currency: 'ETB',
})
const checkoutUrl = client.buildCheckoutUrl(order.prepayId)

// Or both in one call
const { prepayId, checkoutUrl: url } = await client.createCheckoutUrl({
  title: 'Course',
  amount: 500,
})

// Status query (e.g. when a notification never arrived)
const status = await client.queryOrder('order-1')

// Webhook callbacks — returns false on a bad or missing signature
const trusted = client.verifyCallback(await c.req.json())
if (!trusted) return c.json({ error: 'bad signature' }, 400)
```

Lower-level primitives are exported too: `buildStringToSign(body)`,
`signPayload(text, privateKeyPem, padding?)`, and
`verifyPayload(text, signature, publicKeyPem, padding?)`. `SIGN_TYPE` is `'SHA256WithRSA'` and the
signature padding is `pss` or `pkcs1v15`, resolved by `getTelebirrSignaturePadding()`.
`getTelebirrClient()` throws a `TELEBIRR_CONFIG` error when the `TELEBIRR_*` variables are
missing; use `createTelebirrClient(config)` with an explicit `TelebirrConfig` to avoid that.

Every Telebirr business rejection is surfaced as a `TelebirrError` with `retryable: false`, so
`toJobError` converts it to a BullMQ `UnrecoverableError` instead of retrying it. Transport
failures and 5xx responses stay `retryable: true`.

## SMSEthiopia Integration

```typescript
import {
  createSMSEthiopiaClient,
  getSMSEthiopiaClient,
  getSMSEthiopiaConfigFromEnv,
  isValidMsisdn,
  normalizeMsisdn,
  normalizeSmsStatus,
  SMSEthiopiaError,
} from '@abugida/queue/integrations'

const client = getSMSEthiopiaClient() // configured from SMSETHIOPIA_* env vars

const result = await client.send({
  msisdn: '0911000000', // normalised to +251911000000 internally
  text: 'Your code is 1234',
})
// { id: '01J…', segments: 1, status: 'ACCEPTED' }

// Delivery receipt lookup — keep `id` for this
const delivery = await client.getStatus(result.id)
```

MSISDNs are validated and normalised to E.164 (`+251…`); `isValidMsisdn` and `normalizeMsisdn`
are exported for pre-flight checks. 4xx responses become permanent `SMSEthiopiaError`s; 5xx and
transport failures are marked `retryable: true` so the queue retries them with the queue's backoff.

### Shared integration error model

```typescript
import {
  IntegrationError,
  describeError,
  toJobError,
  HttpError,
  HttpNetworkError,
  isRetryableHttpError,
} from '@abugida/queue/integrations'

isRetryableHttpError(error) // transport / 5xx → true
toJobError(error) // IntegrationError → UnrecoverableError when !retryable
describeError(error) // human-readable summary
```

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

## Logging

```typescript
import { getLogger, type Logger } from '@abugida/queue'

const logger = getLogger(config)
const child = getLogger().child({ processor: 'purchase:initiate' })
```

The worker logs start/stop, per-job completion and failure, and stalled jobs at the level
configured in `config.logging`.

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

Runnable examples live in `examples/hono` and `examples/tanstack`.

## License

MIT
