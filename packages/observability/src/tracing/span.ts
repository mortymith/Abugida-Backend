/**
 * Span helper utilities — primarily {@link withSpan}.
 *
 * Provides a callback-based API that manages the full span lifecycle
 * (create, activate, execute, end) while properly handling errors
 * and OpenTelemetry context.
 */

import { trace, context, SpanStatusCode, type Span, type SpanKind } from '@opentelemetry/api'
import { getTracer } from './tracer'

/**
 * Execute `fn` inside a new span named `name`.
 *
 * The span is automatically activated in the current OpenTelemetry context,
 * ended when the callback completes (or throws), and marked as errored
 * when an exception is observed.
 *
 * @param name – span name (should follow the `<domain>.<action>` convention)
 * @param fn   – sync or async callback receiving the active span
 * @param options – optional span options (attributes, kind, …)
 * @returns whatever `fn` returns
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  options?: {
    attributes?: Record<string, string | number | boolean>
    kind?: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER'
  },
): Promise<T> {
  const tracer = getTracer('@abugida/observability')

  const spanKindMap = {
    INTERNAL: 0,
    SERVER: 1,
    CLIENT: 2,
    PRODUCER: 3,
    CONSUMER: 4,
  } as const

  const span = tracer.startSpan(name, {
    ...(options?.kind ? { kind: spanKindMap[options.kind] as unknown as SpanKind } : {}),
    ...(options?.attributes ? { attributes: options.attributes } : {}),
  })

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span)
      span.end()
      return result
    } catch (error) {
      recordSpanError(span, error)
      span.end()
      throw error
    }
  })
}

/**
 * Synchronous variant of {@link withSpan}.
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options?: {
    attributes?: Record<string, string | number | boolean>
  },
): T {
  const tracer = getTracer('@abugida/observability')

  const span = tracer.startSpan(name, {
    ...(options?.attributes ? { attributes: options.attributes } : {}),
  })

  return context.with(trace.setSpan(context.active(), span), () => {
    try {
      const result = fn(span)
      span.end()
      return result
    } catch (error) {
      recordSpanError(span, error)
      span.end()
      throw error
    }
  })
}

/**
 * Record an error on a span without ending it.
 */
export function recordSpanError(span: Span, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  span.setStatus({ code: SpanStatusCode.ERROR, message })
  span.recordException(error instanceof Error ? error : new Error(message))
}
