/**
 * @module bookmarks.routes
 *
 * OpenAPI route definitions for the bookmarks feature module.
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  UnauthorizedSchema,
  NotFoundSchema,
  ConflictSchema,
  ValidationErrorSchema,
  TooManyRequestsSchema,
  BookmarkListQuerySchema,
  ListBookmarksResponseSchema,
  BookmarkCreateBodySchema,
  CreateBookmarkResponseSchema,
} from './bookmarks.schemas'

// ── GET /users/me/bookmarks ────────────────────────────────────────────────

export const listBookmarksRoute = createRoute({
  method: 'get',
  path: '/users/me/bookmarks',
  tags: ['Bookmark'],
  summary: 'List user bookmarks',
  description: 'Returns all bookmarked courses and resources (newest first).',
  security: [{ Bearer: [] }],
  request: {
    query: BookmarkListQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated bookmark list.',
      content: { 'application/json': { schema: ListBookmarksResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListBookmarksRoute = typeof listBookmarksRoute

// ── POST /users/me/bookmarks ───────────────────────────────────────────────

export const createBookmarkRoute = createRoute({
  method: 'post',
  path: '/users/me/bookmarks',
  tags: ['Bookmark'],
  summary: 'Create a bookmark',
  description: 'Bookmark a course or resource for quick access.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Bookmark details.',
      content: { 'application/json': { schema: BookmarkCreateBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Bookmark created.',
      content: { 'application/json': { schema: CreateBookmarkResponseSchema } },
    },
    400: {
      description: 'Invalid request body.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    409: {
      description: 'Item is already bookmarked.',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type CreateBookmarkRoute = typeof createBookmarkRoute

// ── DELETE /users/me/bookmarks/{itemId} ────────────────────────────────────

export const deleteBookmarkRoute = createRoute({
  method: 'delete',
  path: '/users/me/bookmarks/{itemId}',
  tags: ['Bookmark'],
  summary: 'Remove a bookmark',
  description: 'Removes a bookmarked item.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      itemId: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Bookmark removed.',
    },
    400: {
      description: 'Invalid item ID.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Bookmark not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type DeleteBookmarkRoute = typeof deleteBookmarkRoute
