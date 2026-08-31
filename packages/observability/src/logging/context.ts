/**
 * Pino child-logger factory bound to the current OpenTelemetry context.
 *
 * The returned child logger automatically injects `trace_id`, `span_id`,
 * and `trace_flags` into every log record while the parent span is active.
 */

import { trace, context } from '@opentelemetry/api'
import type { Logger } from 'pino'

/**
 * Create a Pino child logger that injects the current trace context.
 *
 * Because Pino child loggers capture their merge object at creation time,
 * this function should be called inside the span's active context to
 * capture the correct trace/span IDs.
 *
 * @param parent - the base `@abugida/observability` logger
 * @param extra  - additional properties to merge into every log line
 */
export function bindLoggerToContext(parent: Logger, extra?: Record<string, unknown>): Logger {
  const span = trace.getSpan(context.active())
  const mergeObject: Record<string, unknown> = { ...extra }

  if (span) {
    const ctx = span.spanContext()
    mergeObject.trace_id = ctx.traceId
    mergeObject.span_id = ctx.spanId
    mergeObject.trace_flags = ctx.traceFlags
  }

  return parent.child(mergeObject)
}

/**
 * Extract the trace context from an active span, if any.
 * Returns `null` when no span is active.
 */
export function getActiveTraceContext(): {
  traceId: string
  spanId: string
  traceFlags: number
} | null {
  const span = trace.getSpan(context.active())
  if (!span) return null
  const ctx = span.spanContext()
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceFlags: ctx.traceFlags,
  }
}
