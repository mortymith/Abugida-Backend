/**
 * Astro integration for @abugida/observability.
 *
 * Provides server-side instrumentation for Astro in server/hybrid mode.
 * When Astro is used in static mode, this module is a no-op and
 * introduces no unnecessary server runtime requirements.
 *
 * IMPORTANT: No browser analytics functionality is included.
 *
 * Usage (astro.config.mjs):
 * ```ts
 * import { astroObservability } from "@abugida/observability/astro";
 *
 * export default defineConfig({
 *   integrations: [
 *     astroObservability({
 *       serviceName: "marketing",
 *       serviceVersion: "1.0.0",
 *       environment: "production",
 *     }),
 *   ],
 *   output: "server", // or "hybrid"
 * });
 * ```
 */

import { initObservability, shutdownObservability } from '../index'
import { withSpan } from '../tracing/span'
import { recordError } from '../errors/record-error'
import { getTracer } from '../tracing/tracer'
import { extractRequestContext } from '../context/request-context'
import {
  trace,
  context as otelContext,
  SpanKind,
  SpanStatusCode,
  type Span,
} from '@opentelemetry/api'
import { SEMATTRS_HTTP_STATUS_CODE, SEMATTRS_HTTP_URL } from '@opentelemetry/semantic-conventions'

export interface AstroObservabilityOptions {
  serviceName: string
  serviceVersion: string
  environment: string
}

const TRACER_NAME = '@abugida/observability/astro'

/**
 * Create an Astro integration that wraps page rendering in spans.
 *
 * This integration hooks into the `astro:server:setup` lifecycle
 * to instrument SSR page rendering.
 *
 * The return type matches Astro's `AstroIntegration` interface without
 * requiring `astro` as a dependency.
 */
export function astroObservability(options: AstroObservabilityOptions): {
  name: string
  hooks: Record<string, (...args: unknown[]) => Promise<void> | void>
} {
  let initialised = false

  return {
    name: '@abugida/observability',
    hooks: {
      async 'astro:server:setup'() {
        if (initialised) return
        await initObservability({
          serviceName: options.serviceName,
          serviceVersion: options.serviceVersion,
          environment: options.environment,
        })
        initialised = true
      },
      async 'astro:server:done'() {
        if (!initialised) return
        await shutdownObservability()
        initialised = false
      },
    },
  }
}

/**
 * Execute a function inside a span for SSR page rendering.
 *
 * Use this inside Astro page components or API routes:
 * ```astro
 * ---
 * import { withPageSpan } from "@abugida/observability/astro";
 *
 * const data = await withPageSpan("page.home", (span) => {
 *   span.setAttribute("astro.page", "/");
 *   return fetchHomeData();
 * });
 * ---
 * ```
 */
export async function withPageSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  options?: {
    attributes?: Record<string, string | number | boolean>
  },
): Promise<T> {
  return withSpan(name, fn, options)
}

/**
 * Wrap Astro middleware to extract trace context from incoming requests.
 *
 * Use inside an Astro middleware file (src/middleware.ts):
 * ```ts
 * import { defineMiddleware } from "astro:middleware";
 * import { instrumentRequest } from "@abugida/observability/astro";
 *
 * export const onRequest = defineMiddleware(async (context, next) => {
 *   return instrumentRequest(
 *     context.request.headers,
 *     context.url.pathname,
 *     next,
 *   );
 * });
 * ```
 */
export async function instrumentRequest(
  headers: Headers,
  pathname: string,
  next: () => Promise<Response>,
): Promise<Response> {
  const tracer = getTracer(TRACER_NAME)
  const parentContext = extractRequestContext(headers)

  const span = tracer.startSpan(`HTTP ${pathname}`, {
    kind: SpanKind.SERVER,
    attributes: {
      [SEMATTRS_HTTP_URL]: pathname,
      'astro.middleware': true,
    },
  })

  try {
    const result = await otelContext.with(trace.setSpan(parentContext, span), async () => next())

    span.setAttribute(SEMATTRS_HTTP_STATUS_CODE, result.status)
    if (result.status >= 500) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${result.status}`,
      })
    }

    return result
  } catch (error) {
    recordError(error, { silent: true })
    throw error
  } finally {
    span.end()
  }
}

/**
 * Record a server-side error in an Astro context.
 */
export function recordAstroError(error: unknown): void {
  recordError(error)
}
