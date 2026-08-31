/**
 * TanStack Start integration for @abugida/observability.
 *
 * This module provides server-side-only utilities for instrumenting
 * TanStack Start server functions, SSR execution, and server-side
 * error handling.
 *
 * IMPORTANT: This module must never be imported in browser bundles.
 * It does not expose OTLP endpoints, collector configuration, or
 * server credentials.
 *
 * Usage (in a server function):
 * ```ts
 * import { withServerSpan } from "@abugida/observability/tanstack";
 *
 * export const publishCourse = createServerFn({ method: 'POST' })
 *   .handler(async ({ data }) => {
 *     return withServerSpan("course-builder.publish", async (span) => {
 *       span.setAttribute("course.id", data.courseId);
 *       return publish(data.courseId);
 *     });
 *   });
 * ```
 */

import { withSpan } from '../tracing/span'
import { recordError } from '../errors/record-error'
import type { Span } from '@opentelemetry/api'

/**
 * Execute a server function inside a new span.
 *
 * This is a convenience wrapper around {@link withSpan} with a
 * tracer name scoped to the TanStack Start integration.
 *
 * @param name - span name (e.g. "ssr.render", "action.submitOrder")
 * @param fn   - the server function to execute within the span
 */
export async function withServerSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  options?: {
    attributes?: Record<string, string | number | boolean>
  },
): Promise<T> {
  return withSpan(name, fn, options)
}

/**
 * Record a server-side error within a TanStack Start server function.
 *
 * Records on the active span and logs via Pino.
 * Use in catch blocks inside server functions.
 */
export function recordServerError(error: unknown): void {
  recordError(error)
}

/**
 * Create a wrapper that instruments a server function.
 *
 * Usage:
 * ```ts
 * const instrumentedFetch = createInstrumentedHandler("api.fetchCourses", async (span, id) => {
 *   span.setAttribute("course.list.page", page);
 *   return fetchCourses(page);
 * });
 * ```
 */
export function createInstrumentedHandler<TArgs extends unknown[], TResult>(
  name: string,
  handler: (span: Span, ...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    return withServerSpan(name, async (span) => {
      return handler(span, ...args)
    })
  }
}
