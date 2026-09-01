/**
 * Hono integration for @abugida/observability.
 *
 * Provides `observabilityMiddleware()` — a Hono middleware that:
 * 1. Extracts incoming trace context from W3C traceparent/tracestate headers
 * 2. Creates an HTTP SERVER span
 * 3. Activates the context
 * 4. Captures request metadata (method, route, HTTP attributes)
 * 5. Captures the response status
 * 6. Records errors when the handler throws
 * 7. Ends the span and restores the previous context
 *
 * Usage:
 * ```ts
 * import { observabilityMiddleware } from "@abugida/observability/hono";
 * app.use("*", observabilityMiddleware());
 * ```
 */

import type { MiddlewareHandler } from 'hono'
import { trace, SpanStatusCode, SpanKind, context } from '@opentelemetry/api'
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_HTTP_URL,
  SEMATTRS_HTTP_USER_AGENT,
  SEMATTRS_HTTP_CLIENT_IP,
} from '@opentelemetry/semantic-conventions'
import { getTracer } from '../tracing/tracer'
import { extractRequestContext } from '../context/request-context'

const TRACER_NAME = '@abugida/observability/hono'

/**
 * Create the Hono observability middleware.
 */
export function observabilityMiddleware(): MiddlewareHandler {
  return async function observability(c, next) {
    const tracer = getTracer(TRACER_NAME)
    const method = c.req.method
    const url = new URL(c.req.url)
    const path = url.pathname
    const route = c.req.routePath ?? path

    // Extract incoming trace context from request headers
    const parentContext = extractRequestContext(c.req.raw.headers)

    // Build span name: "HTTP {method} /route"
    const spanName = `HTTP ${method} ${route}`

    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [SEMATTRS_HTTP_METHOD]: method,
          [SEMATTRS_HTTP_ROUTE]: route,
          [SEMATTRS_HTTP_URL]: `${url.protocol}//${url.host}${path}`,
          ...(c.req.header('user-agent') && {
            [SEMATTRS_HTTP_USER_AGENT]: c.req.header('user-agent')!,
          }),
          ...(c.req.header('x-forwarded-for') && {
            [SEMATTRS_HTTP_CLIENT_IP]: c.req.header('x-forwarded-for')!.split(',')[0]?.trim() ?? '',
          }),
          ...(c.req.header('x-real-ip') && {
            [SEMATTRS_HTTP_CLIENT_IP]: c.req.header('x-real-ip')!,
          }),
        },
      },
      parentContext,
    )

    try {
      // Execute the handler chain inside the span's context
      await context.with(trace.setSpan(parentContext, span), async () => {
        await next()
      })

      // Capture response status
      const status = c.res.status
      span.setAttribute(SEMATTRS_HTTP_STATUS_CODE, status)

      // Mark 5xx as errors
      if (status >= 500) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${status}`,
        })
      } else {
        span.setStatus({ code: SpanStatusCode.UNSET })
      }
    } catch (error) {
      const status = c.res?.status ?? 500
      span.setAttribute(SEMATTRS_HTTP_STATUS_CODE, status)

      const message = error instanceof Error ? error.message : String(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message,
      })
      span.recordException(error instanceof Error ? error : new Error(message))

      throw error
    } finally {
      span.end()
    }
  }
}
