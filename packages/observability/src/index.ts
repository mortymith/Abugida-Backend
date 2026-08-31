/**
 * @abugida/observability — Shared observability layer.
 *
 * This is the single entry-point for the package. It exposes
 * a small, intentional public API:
 *
 * - `initObservability()`  — bootstrap tracing, metrics, logging, and propagation
 * - `shutdownObservability()` — flush and tear down all providers
 * - `logger`              — the shared Pino logger
 * - `getTracer()`          — obtain an OpenTelemetry Tracer
 * - `getMeter()`           — obtain an OpenTelemetry Meter
 * - `createCounter()`      — create a Counter instrument
 * - `createHistogram()`    — create a Histogram instrument
 * - `createUpDownCounter()` — create an UpDownCounter instrument
 * - `incrementCounter()`   — record a counter increment
 * - `recordHistogram()`    — record a histogram observation
 * - `withSpan()`           — execute code inside a managed span
 * - `recordError()`        — record an exception on the active span + log
 *
 * Framework-specific integrations live in subpath exports:
 *   @abugida/observability/hono
 *   @abugida/observability/tanstack
 *   @abugida/observability/astro
 */

// ─── Config & Resource ─────────────────────────────────────────────
import { resolveConfig } from './config'
import type { ObservabilityInitOptions } from './config'
import { createResource } from './resource'

// ─── Tracing ────────────────────────────────────────────────────────
import { initTracerProvider, shutdownTracerProvider } from './tracing/provider'

// ─── Metrics ────────────────────────────────────────────────────────
import { initMeterProvider, shutdownMeterProvider } from './metrics/provider'

// ─── Logging ────────────────────────────────────────────────────────
import { createLogger, getLogger } from './logging/logger'

// ─── Context ────────────────────────────────────────────────────────
import { initPropagation } from './context/propagation'

// ─── State ──────────────────────────────────────────────────────────
let initialised = false

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Initialise the full observability stack.
 *
 * This function is idempotent — calling it more than once returns
 * immediately without creating duplicate providers or exporters.
 *
 * @example
 * ```ts
 * await initObservability({
 *   serviceName: "api",
 *   serviceVersion: "1.0.0",
 *   environment: "production",
 * });
 * ```
 */
export async function initObservability(options: ObservabilityInitOptions): Promise<void> {
  if (initialised) return

  const config = resolveConfig(options)
  const resource = createResource(config.serviceName, config.serviceVersion, config.environment)

  // 1. Propagation (must be first — used by everything else)
  initPropagation()

  // 2. Tracing
  if (config.tracesExporter !== 'none') {
    initTracerProvider(resource, config)
  }

  // 3. Metrics
  if (config.metricsExporter !== 'none') {
    initMeterProvider(resource, config)
  }

  // 4. Logging (Pino — stdout/stderr, no OTLP)
  createLogger(config.serviceName)

  initialised = true
}

/**
 * Flush all pending telemetry and shut down providers.
 *
 * Safe to call even if {@link initObservability} was never called.
 */
export async function shutdownObservability(): Promise<void> {
  try {
    await Promise.all([shutdownTracerProvider(), shutdownMeterProvider()])
  } finally {
    initialised = false
  }
}

/**
 * The shared Pino logger.
 *
 * Throws if {@link initObservability} has not been called.
 */
export const logger = new Proxy({} as ReturnType<typeof getLogger>, {
  get(_target, prop, receiver) {
    const instance = getLogger()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

// ─── Re-exports ─────────────────────────────────────────────────────

export { getTracer } from './tracing/tracer'
export { withSpan } from './tracing/span'
export {
  getMeter,
  createCounter,
  createHistogram,
  createUpDownCounter,
  incrementCounter,
  recordHistogram,
} from './metrics/instruments'
export { recordError } from './errors/record-error'

// Types
export type { ObservabilityInitOptions } from './config'
