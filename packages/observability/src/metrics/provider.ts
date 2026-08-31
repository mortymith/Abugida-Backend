/**
 * MeterProvider singleton management.
 *
 * Creates a single {@link MeterProvider} wired to an OTLP metrics exporter.
 * Idempotent — repeated calls return the same instance.
 */

import {
  type MeterProvider,
  MeterProvider as SDKMeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { type Resource } from '@opentelemetry/resources'
import { type ObservabilityConfig } from '../config'
import { metrics } from '@opentelemetry/api'

let provider: MeterProvider | null = null

/**
 * Initialise the global MeterProvider.
 *
 * Safe to call multiple times.
 */
export function initMeterProvider(resource: Resource, config: ObservabilityConfig): MeterProvider {
  if (provider) {
    return provider
  }

  const exporter = new OTLPMetricExporter({
    url: config.otlpProtocol === 'grpc' ? undefined : `${config.otlpEndpoint}/v1/metrics`,
  })

  const metricReader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 30_000,
    exportTimeoutMillis: 10_000,
  })

  provider = new SDKMeterProvider({
    resource,
    readers: [metricReader],
  })

  // Register as the global provider so that getMeter() works.
  metrics.setGlobalMeterProvider(provider)

  return provider
}

/**
 * Return the already-initialised MeterProvider, or `null`.
 */
export function getMeterProvider(): MeterProvider | null {
  return provider
}

/**
 * Flush and shut down the MeterProvider.
 */
export async function shutdownMeterProvider(): Promise<void> {
  if (provider) {
    try {
      await provider.shutdown()
    } finally {
      provider = null
    }
  }
}

/**
 * Reset the global MeterProvider state.
 *
 * Disables the global meter provider so that a subsequent call to
 * {@link initMeterProvider} will create a fresh instance.
 */
export function resetMeterProvider(): void {
  if (provider) {
    metrics.disable()
  }
  provider = null
}
