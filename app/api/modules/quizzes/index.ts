/**
 * @module quizzes
 *
 * Quizzes feature module — quiz questions, attempts, and answer submission.
 *
 * Usage in app.ts:
 * ```ts
 * import { createQuizzesHandlers, createQuizzesRouteMap, createQuizzesRepository, createQuizzesService } from '#/modules/quizzes'
 *
 * const quizzesRepo = createQuizzesRepository(db)
 * const quizzesService = createQuizzesService(quizzesRepo)
 * const quizzesHandlers = createQuizzesHandlers(quizzesService)
 * for (const { route, handler } of createQuizzesRouteMap(quizzesHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  getQuizQuestionsRoute,
  submitQuizRoute,
  listQuizAttemptsRoute,
  getQuizAttemptRoute,
} from '#/modules/quizzes/quizzes.routes'

export type {
  GetQuizQuestionsRoute,
  SubmitQuizRoute,
  ListQuizAttemptsRoute,
  GetQuizAttemptRoute,
} from '#/modules/quizzes/quizzes.routes'

export { createQuizzesHandlers, createQuizzesRouteMap } from '#/modules/quizzes/quizzes.handlers'

export {
  createQuizzesRepository,
  type QuizzesRepository,
} from '#/modules/quizzes/quizzes.repository'

export {
  createQuizzesService,
  LessonNotFoundError,
  LessonNotQuizTypeError,
  EnrollmentRequiredError,
  QuizAttemptNotFoundError,
  type QuizzesService,
} from '#/modules/quizzes/quizzes.service'

export type {
  QuizQuestionView,
  QuizQuestionSetView,
  QuizSubmitRequestView,
  QuizAttemptResultView,
  QuizAttemptDetailView,
  QuizAttemptsQuery,
} from '#/modules/quizzes/quizzes.types'
