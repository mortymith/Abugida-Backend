import { initObservability, shutdownObservability, logger } from '@abugida/observability'
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

export { logger }
