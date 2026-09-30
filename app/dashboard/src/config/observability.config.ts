import {
  initObservability,
  shutdownObservability,
  logger,
  getMeter,
  createCounter,
  createHistogram,
  incrementCounter,
  recordHistogram,
} from '@abugida/observability'
import { env } from './app.config'

export const observabilityConfig = {
  serviceName: env.OTEL_SERVICE_NAME,
  serviceVersion: env.OTEL_SERVICE_VERSION,
  environment: env.ENVIRONMENT,
} as const

export async function init(): Promise<void> {
  await initObservability(observabilityConfig)
}

export async function shutdown(): Promise<void> {
  await shutdownObservability()
}

// The meter helpers are re-exported alongside `logger` so feature code has one
// import site for telemetry. `initObservability` registers a global
// MeterProvider before any of these are called; until it has, the OpenTelemetry
// API hands back no-op instruments, so importing them at module load is safe.
export { logger, getMeter, createCounter, createHistogram, incrementCounter, recordHistogram }
