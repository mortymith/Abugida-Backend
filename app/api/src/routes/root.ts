import { createRoute, z } from '@hono/zod-openapi'

const RootResponseSchema = z.string().openapi({
  description: 'API welcome message',
  example: 'Hello Hono!',
})

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
