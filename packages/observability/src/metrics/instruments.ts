/**
 * Meter accessor and instrument helpers.
 *
 * Wraps {@link metrics.getMeter} and provides convenience wrappers
 * for creating common instrument types with guardrails against
 * high-cardinality labels.
 */

import {
  metrics,
  type Meter,
  type Counter,
  type Histogram,
  type UpDownCounter,
} from '@opentelemetry/api'

/**
 * High-cardinality label names that should never be used as metric
 * attributes without explicit justification.
 */
const HIGH_CARDINALITY_LABELS = new Set([
  'user_id',
  'course_id',
  'request_id',
  'email',
  'session_id',
  'token',
  'password',
  'ip_address',
])

/**
 * Obtain a {@link Meter} for the given scope.
 *
 * @param name    – instrumentation scope name
 * @param version – optional version
 */
export function getMeter(name: string, version?: string): Meter {
  return metrics.getMeter(name, version)
}

/**
 * Validate that no attribute keys match the high-cardinality blocklist.
 * Logs a warning via console.warn if any are found (does not throw).
 */
function warnHighCardinality(attributes: Record<string, string | number | boolean>): void {
  for (const key of Object.keys(attributes)) {
    if (HIGH_CARDINALITY_LABELS.has(key)) {
      console.warn(
        `[@abugida/observability] Potential high-cardinality label: "${key}". ` +
          'This may cause unbounded metric cardinality.',
      )
    }
  }
}

/**
 * Options for creating a Counter.
 */
export interface CounterOptions {
  description?: string
  unit?: string
}

/**
 * Create a Counter instrument with high-cardinality guardrails.
 */
export function createCounter(meter: Meter, name: string, options?: CounterOptions): Counter {
  return meter.createCounter(name, {
    description: options?.description,
    unit: options?.unit,
  })
}

/**
 * Create a Histogram instrument.
 */
export function createHistogram(meter: Meter, name: string, options?: CounterOptions): Histogram {
  return meter.createHistogram(name, {
    description: options?.description,
    unit: options?.unit,
  })
}

/**
 * Create an UpDownCounter instrument.
 */
export function createUpDownCounter(
  meter: Meter,
  name: string,
  options?: CounterOptions,
): UpDownCounter {
  return meter.createUpDownCounter(name, {
    description: options?.description,
    unit: options?.unit,
  })
}

/**
 * Record a counter increment, warning on high-cardinality attributes.
 */
export function incrementCounter(
  counter: Counter,
  value: number = 1,
  attributes?: Record<string, string | number | boolean>,
): void {
  if (attributes) {
    warnHighCardinality(attributes)
  }
  counter.add(value, attributes)
}

/**
 * Record a histogram observation, warning on high-cardinality attributes.
 */
export function recordHistogram(
  histogram: Histogram,
  value: number,
  attributes?: Record<string, string | number | boolean>,
): void {
  if (attributes) {
    warnHighCardinality(attributes)
  }
  histogram.record(value, attributes)
}
