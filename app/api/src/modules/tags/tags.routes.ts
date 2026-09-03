/**
 * @module tags.routes
 *
 * OpenAPI route definitions for the tags feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  NotFoundSchema,
  TooManyRequestsSchema,
  ListTagsResponseSchema,
  ListCoursesByTagParamsSchema,
  ListCoursesByTagQuerySchema,
  ListCoursesByTagResponseSchema,
} from './tags.schemas'

// ── GET /tags ──────────────────────────────────────────────────────────────

export const listTagsRoute = createRoute({
  method: 'get',
  path: '/tags',
  tags: ['Resources'],
  summary: 'List all tags',
  description: 'Returns all course tags.',
  operationId: 'listTags',
  responses: {
    200: {
      description: 'Tags retrieved',
      content: { 'application/json': { schema: ListTagsResponseSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListTagsRoute = typeof listTagsRoute

// ── GET /tags/{tagId}/courses ──────────────────────────────────────────────

export const listCoursesByTagRoute = createRoute({
  method: 'get',
  path: '/tags/{tagId}/courses',
  tags: ['Resources'],
  summary: 'List courses by tag',
  description: 'Returns published courses associated with the given tag.',
  operationId: 'listCoursesByTag',
  request: {
    params: ListCoursesByTagParamsSchema,
    query: ListCoursesByTagQuerySchema,
  },
  responses: {
    200: {
      description: 'Courses retrieved',
      content: { 'application/json': { schema: ListCoursesByTagResponseSchema } },
    },
    404: {
      description: 'Tag not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListCoursesByTagRoute = typeof listCoursesByTagRoute
