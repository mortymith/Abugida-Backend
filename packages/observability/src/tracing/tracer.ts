/**
 * Tracer accessor.
 *
 * Thin wrapper around {@link trace.getTracer} that ensures every call
 * uses the globally-registered TracerProvider.
 */

import { trace } from '@opentelemetry/api'
import type { Tracer } from '@opentelemetry/api'

/**
 * Obtain a {@link Tracer} for the given instrumentation scope.
 *
 * @param name    – instrumentation library name (e.g. "course")
 * @param version – optional version of the instrumentation library
 */
export function getTracer(name: string, version?: string): Tracer {
  return trace.getTracer(name, version)
}
