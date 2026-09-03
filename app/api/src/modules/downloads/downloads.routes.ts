/**
 * @module downloads.routes
 *
 * OpenAPI route definitions for the downloads feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  UnauthorizedSchema,
  NotFoundSchema,
  ConflictSchema,
  ValidationErrorSchema,
  TooManyRequestsSchema,
  CourseIdParamSchema,
  DownloadStatusResponseSchema,
  PresignedDownloadUrlResponseSchema,
  DownloadInitiatedResponseSchema,
} from './downloads.schemas'

// ── POST /courses/{courseId}/download ──────────────────────────────────────

export const initiateDownloadRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}/download',
  tags: ['Downloads'],
  summary: 'Initiate course download',
  description:
    'Initiates a course content download package. Validates enrollment and download size limits (max 500MB).',
  operationId: 'initiateDownload',
  security: [{ Bearer: [] }],
  request: {
    params: CourseIdParamSchema,
  },
  responses: {
    200: {
      description: 'Download initiated',
      content: { 'application/json': { schema: DownloadInitiatedResponseSchema } },
    },
    400: {
      description: 'Invalid course ID.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    403: {
      description: 'Not enrolled in this course.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Course not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    409: {
      description: 'Download size exceeds limit.',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type InitiateDownloadRoute = typeof initiateDownloadRoute

// ── GET /courses/{courseId}/download/status ────────────────────────────────

export const getDownloadStatusRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/download/status',
  tags: ['Downloads'],
  summary: 'Get download status',
  description: 'Returns current download preparation status for a course.',
  operationId: 'getDownloadStatus',
  security: [{ Bearer: [] }],
  request: {
    params: CourseIdParamSchema,
  },
  responses: {
    200: {
      description: 'Download status retrieved',
      content: { 'application/json': { schema: DownloadStatusResponseSchema } },
    },
    400: {
      description: 'Invalid course ID.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    403: {
      description: 'Not enrolled in this course.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Course not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetDownloadStatusRoute = typeof getDownloadStatusRoute

// ── GET /courses/{courseId}/download/presigned-url ─────────────────────────

export const getPresignedUrlRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/download/presigned-url',
  tags: ['Downloads'],
  summary: 'Get presigned download URL',
  description: 'Returns a time-limited presigned URL for downloading the course package.',
  operationId: 'getPresignedUrl',
  security: [{ Bearer: [] }],
  request: {
    params: CourseIdParamSchema,
  },
  responses: {
    200: {
      description: 'Presigned URL retrieved',
      content: { 'application/json': { schema: PresignedDownloadUrlResponseSchema } },
    },
    400: {
      description: 'Invalid course ID.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    403: {
      description: 'Not enrolled in this course.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Course not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetPresignedUrlRoute = typeof getPresignedUrlRoute
