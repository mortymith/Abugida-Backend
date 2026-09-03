/**
 * @module system.routes
 *
 * Route definitions for the system module — root, liveness, and readiness probes.
 */

import { createRoute } from '@hono/zod-openapi'
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
