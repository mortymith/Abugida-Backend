/**
 * @module observability
 *
 * Worker-specific observability composition. Initializes the shared
 * `@abugida/observability` stack (Pino logging + OpenTelemetry tracing &
 * metrics) with the validated worker configuration.
 *
 * Direction:
 *   workerEnv → observability → @abugida/observability
 *
 * `initObservability()` is idempotent and must run before the shared logger is
 * first used. Sensitive values are redacted by the shared logger's Pino
 * `redact` config; nothing here adds secrets to the log path.
 */

import { initObservability, shutdownObservability, logger } from '@abugida/observability'
import { workerEnv } from './env'

export const observabilityConfig = {
  serviceName: workerEnv.OTEL_SERVICE_NAME,
  serviceVersion: workerEnv.OTEL_SERVICE_VERSION,
  environment: workerEnv.NODE_ENV,
} as const

/** Bootstrap tracing, metrics, logging and propagation. Idempotent. */
export async function init(): Promise<void> {
  // The shared package reads these from the process environment at init
  // time; write the validated values back so the library and the worker
  // cannot disagree. This is the single sanctioned `process.env` write in
  // the configuration layer.
  process.env.LOG_LEVEL = workerEnv.LOG_LEVEL
  process.env.OTEL_SERVICE_NAME = workerEnv.OTEL_SERVICE_NAME
  process.env.OTEL_SERVICE_VERSION = workerEnv.OTEL_SERVICE_VERSION
  process.env.OTEL_DEPLOYMENT_ENVIRONMENT = workerEnv.OTEL_DEPLOYMENT_ENVIRONMENT
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = workerEnv.OTEL_EXPORTER_OTLP_ENDPOINT
  process.env.OTEL_TRACES_EXPORTER = workerEnv.OTEL_TRACES_EXPORTER
  process.env.OTEL_METRICS_EXPORTER = workerEnv.OTEL_METRICS_EXPORTER
  process.env.OTEL_TRACES_SAMPLER = workerEnv.OTEL_TRACES_SAMPLER
  process.env.OTEL_TRACES_SAMPLER_ARG = String(workerEnv.OTEL_TRACES_SAMPLER_ARG)

  await initObservability(observabilityConfig)
}

/** Flush and tear down all telemetry providers. */
export async function shutdown(): Promise<void> {
  await shutdownObservability()
}

export { logger }
