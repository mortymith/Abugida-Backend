/**
 * @module cors
 *
 * CORS configuration. Origins come
 * from validated application config (`appConfig.corsOrigins`), never hardcoded
 * production origins. The remaining header/method/expose lists mirror the spec
 * exactly so browsers and mobile WebViews can call the API with bearer tokens.
 */

import type { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { appConfig } from '../config/app_config'
import type { AppEnv } from './types'

const CORS_OPTIONS = {
  origin: appConfig.corsOrigins,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'X-Request-ID', 'Accept', 'X-API-Key'],
  exposeHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
    'X-Request-ID',
    'ETag',
    'Link',
  ],
  credentials: true,
  maxAge: 86400,
}

export function corsMiddleware(): MiddlewareHandler<AppEnv> {
  return cors(CORS_OPTIONS)
}
