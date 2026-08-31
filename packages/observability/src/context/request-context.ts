/**
 * Request-context helpers.
 *
 * Utilities for extracting and managing per-request trace context,
 * typically used by framework integrations (Hono, TanStack, Astro).
 */

import { type Context } from '@opentelemetry/api'
import { extractContext } from './propagation'

/**
 * Extract trace context from a set of HTTP headers.
 *
 * This is a convenience wrapper that normalises header names
 * to lowercase (as required by the W3C propagator) and calls
 * {@link extractContext}.
 *
 * @param headers - raw HTTP headers (case-insensitive access)
 * @returns OpenTelemetry Context with any extracted trace info
 */
export function extractRequestContext(
  headers: Headers | Record<string, string> | { get(name: string): string | null | undefined },
): Context {
  const carrier: Record<string, string> = {}

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      carrier[key.toLowerCase()] = value
    })
  } else if ('get' in headers && typeof headers.get === 'function') {
    // Generic object with get() — iterate known propagation headers
    const keys = ['traceparent', 'tracestate', 'baggage']
    for (const key of keys) {
      const val = headers.get(key)
      if (val) carrier[key.toLowerCase()] = val
    }
  } else {
    // Plain record
    for (const [key, value] of Object.entries(headers)) {
      carrier[key.toLowerCase()] = value
    }
  }

  return extractContext(carrier)
}
