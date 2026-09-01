/**
 * @module observability
 *
 * API-specific observability composition. Initializes the shared
 * `@abugida/observability` stack (Pino logging + OpenTelemetry tracing &
 * metrics) with the validated application configuration.
 *
 * Direction:
 *   app_config → observability → @abugida/observability
 *
 * `initObservability()` is idempotent and must run before the shared logger is
 * first used. Sensitive values are redacted by the shared logger's Pino
 * `redact` config; nothing here adds secrets to the log path.
 */

import { initObservability, shutdownObservability, logger } from '@abugida/observability'
import { appConfig } from './app_config'

export const observabilityConfig = {
  serviceName: appConfig.OTEL_SERVICE_NAME,
  serviceVersion: appConfig.OTEL_SERVICE_VERSION,
  environment: appConfig.NODE_ENV,
} as const

/** Bootstrap tracing, metrics, logging and propagation. Idempotent. */
export async function init(): Promise<void> {
  await initObservability(observabilityConfig)
}

/** Flush and tear down all telemetry providers. */
export async function shutdown(): Promise<void> {
  await shutdownObservability()
}

export { logger }
