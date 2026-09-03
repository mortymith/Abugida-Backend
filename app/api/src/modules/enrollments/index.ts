/**
 * @module enrollments
 *
 * Enrollments feature module — progress tracking, enrollment management,
 * and lesson completion handling.
 *
 * Usage in app.ts:
 * ```ts
 * import { createEnrollmentsHandlers, createEnrollmentsRouteMap, createEnrollmentsRepository, createEnrollmentsService } from './modules/enrollments'
 *
 * const enrollmentsRepo = createEnrollmentsRepository(db)
 * const enrollmentsService = createEnrollmentsService(enrollmentsRepo, queue)
 * const enrollmentsHandlers = createEnrollmentsHandlers(enrollmentsService)
 * for (const { route, handler } of createEnrollmentsRouteMap(enrollmentsHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  getProgressRoute,
  listEnrollmentsRoute,
  getEnrollmentRoute,
  listLessonCompletionsRoute,
  updateLessonCompletionRoute,
} from './enrollments.routes'

export type {
  GetProgressRoute,
  ListEnrollmentsRoute,
  GetEnrollmentRoute,
  ListLessonCompletionsRoute,
  UpdateLessonCompletionRoute,
} from './enrollments.routes'

export { createEnrollmentsHandlers, createEnrollmentsRouteMap } from './enrollments.handlers'

export {
  createEnrollmentsRepository,
  encodeCursor,
  decodeCursor,
  type EnrollmentsRepository,
} from './enrollments.repository'

export {
  createEnrollmentsService,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  ConflictError,
  type EnrollmentsService,
} from './enrollments.service'

export type {
  ProgressStats,
  EnrollmentView,
  EnrollmentDetailView,
  LessonCompletionView,
  LessonCompletionToggle,
  EnrollmentListQuery,
  LessonCompletionListQuery,
} from './enrollments.types'
