/**
 * @module env
 *
 * Single source of truth for the worker's environment configuration.
 *
 * Responsibilities:
 *  1. Load `.env` once via `dotenv/config`.
 *  2. Validate every variable the worker needs against a Zod schema.
 *  3. Apply defaults and normalize values (strings → numbers/booleans).
 *  4. Fail fast with a human-readable error when configuration is invalid,
 *     without ever leaking secret values.
 *  5. Export a strongly-typed, validated `workerEnv` object.
 *
 * Downstream modules (`./queue`, `./observability`) consume `workerEnv` and
 * never touch `process.env` for application configuration.
 *
 * The contract itself (`JobType`, `JobDataMap`, `QUEUE_NAMES`, …) lives in
 * `@abugida/queue` — this module only describes the environment the worker
 * runs in (ADR-028).
 */

import 'dotenv/config'

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ENV_NAMES = ['development', 'staging', 'production', 'test'] as const

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const

/** Parses `"true"`/`"1"` → true and `"false"`/`"0"` → false. Rejects anything else. */
const booleanFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1')

const workerEnvSchema = z
  .object({
    // ── Runtime identity ───────────────────────────────────────────────────
    // `ENVIRONMENT` wins when both it and `NODE_ENV` are set (the deployment
    // injects `ENVIRONMENT`; Bun and the Docker image set `NODE_ENV`).
    ENVIRONMENT: z.enum(ENV_NAMES).optional(),
    NODE_ENV: z.enum(ENV_NAMES).optional(),
    // Health-server port. Local development uses 3003; the container image
    // pins 3000 (see docker/compose/app.yml).
    PORT: z.coerce.number().int().min(1).max(65535).default(3003),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    // Used to build the worker id (`<APP_NAME>-worker-<pid>`).
    APP_NAME: z.string().min(1).default('abugida-worker'),

    // ── Queue selection ────────────────────────────────────────────────────
    // `all` consumes every declared queue; a CSV of full queue names
    // (e.g. `abugida.purchases,abugida.webhooks`) restricts the worker to
    // those queues — the mechanism that gates a per-queue rollout.
    WORKER_QUEUES: z.string().min(1).default('all'),

    // ── Redis (BullMQ queues live on Redis / Redis Sentinel) ──────────────
    REDIS_HOST: z.string().min(1).default('localhost'),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    // ACL username (Redis 6+). The Abugida infra runs `user default off` and
    // exposes an `app` ACL user — set REDIS_USERNAME=app in development.
    REDIS_USERNAME: z.string().min(1).optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
    REDIS_TLS: booleanFromEnv,

    // ── Observability (Pino + OpenTelemetry) ───────────────────────────────
    OTEL_SERVICE_NAME: z.string().min(1).default('worker'),
    OTEL_SERVICE_VERSION: z.string().min(1).default('0.0.1'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    OTEL_TRACES_EXPORTER: z.enum(['otlp', 'jaeger', 'zipkin', 'console', 'none']).default('otlp'),
    OTEL_METRICS_EXPORTER: z.enum(['otlp', 'console', 'none']).default('otlp'),
    OTEL_TRACES_SAMPLER: z.string().min(1).default('parentbased_always_on'),
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(1),
  })
  .transform((env) => {
    const environment = env.ENVIRONMENT ?? env.NODE_ENV ?? 'development'
    return {
      ...env,
      NODE_ENV: environment,
      OTEL_DEPLOYMENT_ENVIRONMENT: environment,
    }
  })

export type WorkerEnv = z.infer<typeof workerEnvSchema>

// ---------------------------------------------------------------------------
// Validation & error formatting
// ---------------------------------------------------------------------------

function formatConfigError(error: z.ZodError): string {
  const details = error.issues.map((issue) => {
    const path = issue.path.join('.')
    return `  - ${path}: ${issue.message}`
  })
  return [
    '[worker-config] Invalid environment configuration.',
    'Fix the variables listed below, then restart. Secret values are never included in this report.',
    ...details,
  ].join('\n')
}

/**
 * Parse and validate the environment exactly once.
 *
 * The validation report names the offending variables and the problem without
 * echoing their values, so credentials (REDIS_PASSWORD, TELEBIRR_APP_SECRET,
 * SMS_ETHIOPIA_API_KEY) are never logged.
 */
export function parseWorkerEnv(source: Record<string, unknown> = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(source)

  if (!result.success) {
    throw new Error(formatConfigError(result.error))
  }

  return result.data
}

/**
 * The validated worker environment. Import this everywhere instead of
 * reading `process.env` directly.
 */
export const workerEnv: WorkerEnv = parseWorkerEnv()

/**
 * The identity of this worker process.
 *
 * Used in BullMQ's worker name and in every log line the worker emits, so a
 * job can be traced back to the process that ran it.
 */
export function getWorkerId(): string {
  return `${workerEnv.APP_NAME}-worker-${process.pid}`
}
