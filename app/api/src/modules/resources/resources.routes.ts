/**
 * @module resources.routes
 *
 * OpenAPI route definitions for the resources feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  NotFoundSchema,
  GoneSchema,
  TooManyRequestsSchema,
  ListCoursesByExamTypeParamsSchema,
  ListCoursesByExamTypeQuerySchema,
  ListCoursesByExamTypeResponseSchema,
  GetCourseParamsSchema,
  GetCourseResponseSchema,
  GetCourseCurriculumParamsSchema,
  GetCourseCurriculumResponseSchema,
  ListModulesParamsSchema,
  ListModulesResponseSchema,
  ListModuleLessonsParamsSchema,
  ListModuleLessonsQuerySchema,
  ListModuleLessonsResponseSchema,
  GetResourceParamsSchema,
  GetResourceResponseSchema,
} from './resources.schemas'

// ── GET /exam-types/{examTypeId}/courses ───────────────────────────────────

export const listCoursesByExamTypeRoute = createRoute({
  method: 'get',
  path: '/exam-types/{examTypeId}/courses',
  tags: ['Resources'],
  summary: 'List courses for an exam type',
  description: 'Returns published courses for the given exam type with cursor-based pagination.',
  operationId: 'listCourses',
  request: {
    params: ListCoursesByExamTypeParamsSchema,
    query: ListCoursesByExamTypeQuerySchema,
  },
  responses: {
    200: {
      description: 'Courses retrieved',
      content: { 'application/json': { schema: ListCoursesByExamTypeResponseSchema } },
    },
    404: {
      description: 'Exam type not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListCoursesByExamTypeRoute = typeof listCoursesByExamTypeRoute

// ── GET /courses/{courseId} ────────────────────────────────────────────────

export const getCourseRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}',
  tags: ['Resources'],
  summary: 'Get course details',
  description: 'Returns full course metadata including ratings and popularity.',
  operationId: 'getCourse',
  request: {
    params: GetCourseParamsSchema,
  },
  responses: {
    200: {
      description: 'Course details retrieved',
      headers: {
        ETag: {
          description: 'Entity tag based on row_version',
          schema: { type: 'string', example: 'W/"3"' },
        },
        'Last-Modified': {
          schema: { type: 'string', format: 'http-date' },
        },
        'Cache-Control': {
          schema: { type: 'string', example: 'private, max-age=300' },
        },
      },
      content: { 'application/json': { schema: GetCourseResponseSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    410: {
      description: 'Course has been removed',
      content: { 'application/problem+json': { schema: GoneSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetCourseRoute = typeof getCourseRoute

// ── GET /courses/{courseId}/curriculum ─────────────────────────────────────

export const getCourseCurriculumRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/curriculum',
  tags: ['Resources'],
  summary: 'Get course curriculum',
  description: 'Returns the full hierarchical curriculum structure including modules and lessons.',
  operationId: 'getCourseCurriculum',
  request: {
    params: GetCourseCurriculumParamsSchema,
  },
  responses: {
    200: {
      description: 'Curriculum retrieved',
      content: { 'application/json': { schema: GetCourseCurriculumResponseSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetCourseCurriculumRoute = typeof getCourseCurriculumRoute

// ── GET /courses/{courseId}/modules ────────────────────────────────────────

export const listModulesRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/modules',
  tags: ['Resources'],
  summary: 'List modules in a course',
  description: 'Returns a summary list of modules for a course.',
  operationId: 'listModules',
  request: {
    params: ListModulesParamsSchema,
  },
  responses: {
    200: {
      description: 'Modules retrieved',
      content: { 'application/json': { schema: ListModulesResponseSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListModulesRoute = typeof listModulesRoute

// ── GET /modules/{moduleId}/lessons ────────────────────────────────────────

export const listModuleLessonsRoute = createRoute({
  method: 'get',
  path: '/modules/{moduleId}/lessons',
  tags: ['Resources'],
  summary: 'List lessons in a module',
  description: 'Returns all lessons within a module.',
  operationId: 'listModuleLessons',
  request: {
    params: ListModuleLessonsParamsSchema,
    query: ListModuleLessonsQuerySchema,
  },
  responses: {
    200: {
      description: 'Lessons retrieved',
      content: { 'application/json': { schema: ListModuleLessonsResponseSchema } },
    },
    404: {
      description: 'Module not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListModuleLessonsRoute = typeof listModuleLessonsRoute

// ── GET /resources/{resourceId} ────────────────────────────────────────────

export const getResourceRoute = createRoute({
  method: 'get',
  path: '/resources/{resourceId}',
  tags: ['Resources'],
  summary: 'Get resource (lesson) details',
  description:
    'Returns lesson details. "Resource" = DB "lesson". ETag is derived from row_version.',
  operationId: 'getResource',
  request: {
    params: GetResourceParamsSchema,
  },
  responses: {
    200: {
      description: 'Resource details retrieved',
      headers: {
        ETag: {
          description: 'Entity tag derived from row_version',
          schema: { type: 'string', example: 'W/"5"' },
        },
        'Last-Modified': {
          description: 'Timestamp of last modification',
          schema: { type: 'string', format: 'http-date' },
        },
        'Cache-Control': {
          schema: { type: 'string', example: 'private, max-age=300' },
        },
      },
      content: { 'application/json': { schema: GetResourceResponseSchema } },
    },
    404: {
      description: 'Resource not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    410: {
      description: 'Resource has been removed',
      content: { 'application/problem+json': { schema: GoneSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetResourceRoute = typeof getResourceRoute
