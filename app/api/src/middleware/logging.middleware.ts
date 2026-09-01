/**
 * @module logging
 *
 * Access-log middleware. The shared `@abugida/observability` package already
 * creates the OTel HTTP span and injects `trace_id`/`span_id` into every Pino
 * record via its mixin, so this middleware only adds the request-level detail
 * the span doesn't carry as log text: request id, method, route, status,
 * duration, and the resolved user id.
 *
 * Never logs request bodies, headers, cookies, tokens or secrets. The shared
 * logger's Pino `redact` config is a backstop, not the primary control.
 */

import type { MiddlewareHandler } from 'hono'
import { appConfig } from '../config/app_config'
import { logger } from '../config/observability'
import type { AppEnv } from './types'

export function loggingMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now()
    const method = c.req.method
    const path = c.req.routePath ?? c.req.path
    const requestId = c.get('requestId')

    try {
      await next()
    } finally {
      const status = c.res.status
      const durationMs = performance.now() - start
      const userId = c.get('user')?.id
      const isSlow = durationMs > appConfig.SLOW_REQUEST_THRESHOLD_MS

      const fields = {
        requestId,
        method,
        path,
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        ...(userId ? { userId } : {}),
      }

      if (status >= 500) {
        logger.error(fields, 'request failed')
      } else if (status >= 400) {
        logger.warn(fields, 'request rejected')
      } else if (isSlow) {
        logger.warn(fields, 'slow request completed')
      } else {
        logger.info(fields, 'request completed')
      }
    }
  }
}
