import { createRoute, z } from '@hono/zod-openapi'

const HealthStatusSchema = z.enum(['up', 'down', 'disabled'])

const HealthResponseSchema = z
  .object({
    api: HealthStatusSchema,
    postgres: HealthStatusSchema,
    queue: HealthStatusSchema,
    storage: HealthStatusSchema,
  })
  .openapi('HealthCheck')

const ErrorResponseSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    correlationId: z.string().uuid().optional(),
  })
  .openapi('ProblemDetail')

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  description:
    'Probes PostgreSQL, the job queue (BullMQ/Redis), and object storage (S3) and returns the status of each service.',
  responses: {
    200: {
      description: 'All services are healthy.',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
    503: {
      description: 'One or more services are unhealthy.',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
    422: {
      description: 'Validation error',
      content: {
        'application/problem+json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export type HealthRoute = typeof healthRoute
