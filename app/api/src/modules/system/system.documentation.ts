/**
 * @module system.documentation
 *
 * Registers the self-hosted API documentation endpoints — the OpenAPI 3.1
 * document at `GET /docs` and the Scalar reference UI at `/scalar`.
 *
 * These are development-only: the endpoints are never mounted in production.
 * `doc31` registers `/docs` as a plain route (not via the OpenAPI registry),
 * so the documentation endpoint does not describe itself in the generated spec.
 */

import type { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { appConfig } from '@/config/app_config'
import type { AppEnv } from '@/middleware/types'

/**
 * Mount the documentation endpoints onto the composed Hono application.
 * Called once from `app.ts` after all feature routes are registered.
 */
export function registerSystemDocumentation(app: OpenAPIHono<AppEnv>): void {
  if (appConfig.NODE_ENV === 'production') return

  app.doc31('/docs', {
    openapi: '3.1.0',
    info: {
      title: 'Abugida API',
      version: appConfig.OTEL_SERVICE_VERSION,
      description:
        'Abugida Learning Platform REST API. This documentation is auto-generated from route definitions and Zod schemas.',
      contact: {
        name: 'Abugida Engineering',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://${appConfig.HOST}:${appConfig.PORT}`,
        description: 'Local development server',
      },
    ],
  })

  app.use(
    '/scalar',
    Scalar({
      url: '/docs',
      pageTitle: 'Abugida API — Scalar Reference',
    }),
  )
}
