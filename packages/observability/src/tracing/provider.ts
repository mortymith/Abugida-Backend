/**
 * TracerProvider singleton management.
 *
 * Creates a single TracerProvider wired to an OTLP exporter.
 * Subsequent calls to {@link initTracerProvider} return the same instance
 * (idempotent initialization).
 */

import { BatchSpanProcessor, BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import { trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import type { Resource } from '@opentelemetry/resources'
import type { ObservabilityConfig } from '../config'

let provider: BasicTracerProvider | null = null

/**
 * Initialize the global TracerProvider.
 *
 * Safe to call multiple times — returns the already-created provider
 * on subsequent invocations.
 */
export function initTracerProvider(
  resource: Resource,
  config: ObservabilityConfig,
): BasicTracerProvider {
  if (provider) {
    return provider
  }

  const exporter = new OTLPTraceExporter(
    config.otlpProtocol === 'grpc' ? {} : { url: `${config.otlpEndpoint}/v1/traces` },
  )

  // BatchSpanProcessor batches spans before exporting, which is more
  // efficient for production workloads than SimpleSpanProcessor.
  // (OTel 2.x: processors are wired via the constructor; addSpanProcessor()
  // and register() no longer exist on BasicTracerProvider.)
  provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  })

  // Register as the global provider so that getTracer() picks it up
  // without requiring an explicit provider reference.
  trace.setGlobalTracerProvider(provider)

  return provider
}

/**
 * Return the already-initialized TracerProvider, or `null` if
 * {@link initTracerProvider} has not yet been called.
 */
export function getTracerProvider(): BasicTracerProvider | null {
  return provider
}

/**
 * Flush and shut down the TracerProvider.
 * Returns a promise that resolves once pending spans have been exported.
 */
export async function shutdownTracerProvider(): Promise<void> {
  if (provider) {
    try {
      await provider.shutdown()
    } finally {
      provider = null
    }
  }
}

/**
 * Reset the global TracerProvider state.
 *
 * Disables the global tracer and nulls the local reference so that
 * a subsequent call to {@link initTracerProvider} will create a fresh instance.
 */
export function resetTracerProvider(): void {
  trace.disable()
  provider = null
}
