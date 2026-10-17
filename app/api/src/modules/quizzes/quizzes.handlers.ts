/**
 * @module quizzes.handlers
 *
 * Route handler implementations for the quizzes feature module.
 */

import type { Context } from 'hono'
import type { QuizzesService } from './quizzes.service'
import {
  LessonNotFoundError,
  LessonNotQuizTypeError,
  EnrollmentRequiredError,
  QuizAttemptNotFoundError,
  QuizNotFoundError,
  QuizMaxAttemptsExceededError,
} from './quizzes.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createQuizzesHandlers(service: QuizzesService) {
  return {
    async getQuizQuestions(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const resourceId = c.req.param('resourceId') as string

      try {
        const result = await service.getQuizQuestions(user.id, resourceId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof LessonNotFoundError)
          return problemResponse(c, { status: 404, detail: 'Lesson not found.' })
        if (error instanceof LessonNotQuizTypeError)
          return problemResponse(c, { status: 422, detail: 'Lesson is not a quiz type.' })
        if (error instanceof EnrollmentRequiredError)
          return problemResponse(c, {
            status: 404,
            detail: 'You must be enrolled in this course to access the quiz.',
          })
        throw error
      }
    },

    async submitQuiz(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const resourceId = c.req.param('resourceId') as string
      const body = await c.req.json()

      try {
        const result = await service.submitQuiz(user.id, resourceId, {
          answers: body.answers,
          startedAt: body.startedAt,
        })
        return c.json({ data: result }, 201)
      } catch (error) {
        if (error instanceof LessonNotFoundError)
          return problemResponse(c, { status: 404, detail: 'Lesson not found.' })
        if (error instanceof LessonNotQuizTypeError)
          return problemResponse(c, { status: 422, detail: 'Lesson is not a quiz type.' })
        if (error instanceof EnrollmentRequiredError)
          return problemResponse(c, {
            status: 404,
            detail: 'You must be enrolled in this course to access the quiz.',
          })
        if (error instanceof QuizNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        if (error instanceof QuizMaxAttemptsExceededError)
          return problemResponse(c, { status: 422, detail: error.message })
        throw error
      }
    },

    async listQuizAttempts(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const resourceId = c.req.param('resourceId') as string
      const query = c.req.query()

      try {
        const result = await service.listQuizAttempts(user.id, resourceId, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof LessonNotFoundError)
          return problemResponse(c, { status: 404, detail: 'Lesson not found.' })
        if (error instanceof LessonNotQuizTypeError)
          return problemResponse(c, { status: 422, detail: 'Lesson is not a quiz type.' })
        throw error
      }
    },

    async getQuizAttempt(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const attemptId = c.req.param('attemptId') as string

      try {
        const result = await service.getQuizAttempt(user.id, attemptId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof QuizAttemptNotFoundError)
          return problemResponse(c, { status: 404, detail: 'Quiz attempt not found.' })
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  getQuizQuestionsRoute,
  submitQuizRoute,
  listQuizAttemptsRoute,
  getQuizAttemptRoute,
} from './quizzes.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createQuizzesRouteMap(handlers: ReturnType<typeof createQuizzesHandlers>) {
  return [
    { route: getQuizQuestionsRoute, handler: handlers.getQuizQuestions as AnyHandler },
    { route: submitQuizRoute, handler: handlers.submitQuiz as AnyHandler },
    { route: listQuizAttemptsRoute, handler: handlers.listQuizAttempts as AnyHandler },
    { route: getQuizAttemptRoute, handler: handlers.getQuizAttempt as AnyHandler },
  ] as const
}
