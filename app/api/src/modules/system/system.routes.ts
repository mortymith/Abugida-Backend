/**
 * @module system.routes
 *
 * Route definitions for the system module — root, liveness, and readiness probes.
 * Also includes the self-hosted API documentation endpoints (OpenAPI 3.1 document
 * at `GET /docs` and Scalar reference UI at `/scalar`), which are development-only.
 */

import type { OpenAPIHono } from '@hono/zod-openapi'
import { createRoute } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { appConfig } from '@/config/app_config'
import type { AppEnv } from '@/middleware/types'
import {
  RootResponseSchema,
  HealthLivenessResponseSchema,
  HealthReadinessResponseSchema,
} from './system.schemas'

// ── GET / ───────────────────────────────────────────────────────────────

export const rootRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'API root',
  description: 'Returns a welcome message confirming the API is running.',
  responses: {
    200: {
      description: 'Success',
      content: {
        'text/plain': {
          schema: RootResponseSchema,
        },
      },
    },
  },
})

export type RootRoute = typeof rootRoute

// ── GET /health (liveness) ──────────────────────────────────────────────

export const healthLivenessRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Liveness probe',
  description:
    'Returns 200 OK if the Abugida application process is running.\nNo authentication required. No dependency checks performed.',
  security: [],
  responses: {
    200: {
      description: 'Service is alive',
      content: {
        'application/json': {
          schema: HealthLivenessResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many requests',
    },
    500: {
      description: 'Internal server error',
    },
  },
})

export type HealthLivenessRoute = typeof healthLivenessRoute

// ── GET /health/ready (readiness) ───────────────────────────────────────

export const healthReadinessRoute = createRoute({
  method: 'get',
  path: '/health/ready',
  tags: ['System'],
  summary: 'Readiness probe',
  description:
    'Returns 200 OK only if all critical dependencies are available.\nChecks database connectivity, SMS provider, and payment gateway status.',
  security: [],
  responses: {
    200: {
      description: 'All dependencies available',
      content: {
        'application/json': {
          schema: HealthReadinessResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many requests',
    },
    503: {
      description: 'One or more dependencies unavailable',
      content: {
        'application/json': {
          schema: HealthReadinessResponseSchema,
        },
      },
    },
  },
})

export type HealthReadinessRoute = typeof healthReadinessRoute

// ── Documentation endpoints (development only) ──────────────────────────

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
      {
        url: 'https://accuracy-flip-playing.ngrok-free.dev',
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
