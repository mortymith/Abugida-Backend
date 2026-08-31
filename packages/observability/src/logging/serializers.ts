/**
 * Pino serializers and merge-object factory.
 *
 * The trace-context merge object is the mechanism that injects
 * `trace_id`, `span_id`, and `trace_flags` into every log line
 * when an OpenTelemetry span is active.
 */

import { trace, context } from '@opentelemetry/api'

/**
 * Sensitive header names that must never appear in logs.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'proxy-authorization',
  'www-authenticate',
])

/**
 * Redact sensitive headers from a record.
 * Returns a shallow copy with matching keys replaced by "[REDACTED]".
 */
export function redactSensitiveHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    safe[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : (value ?? '')
  }
  return safe
}

/**
 * Build a merge object containing trace context fields if a span
 * is currently active.
 *
 * Returns an empty object when no span is active — this ensures
 * we never fabricate fake trace IDs.
 */
export function createTraceMergeObject(): Record<string, unknown> {
  const span = trace.getSpan(context.active())
  if (!span) {
    return {}
  }

  const spanContext = span.spanContext()
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags,
  }
}
