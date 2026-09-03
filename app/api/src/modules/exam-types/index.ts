/**
 * @module exam-types
 *
 * Exam types feature module — public-facing exam type hierarchy navigation.
 *
 * Usage in app.ts:
 * ```ts
 * import { createExamTypesHandlers, createExamTypesRouteMap, createExamTypesRepository, createExamTypesService } from './modules/exam-types'
 *
 * const examTypesRepo = createExamTypesRepository(db)
 * const examTypesService = createExamTypesService(examTypesRepo)
 * const examTypesHandlers = createExamTypesHandlers(examTypesService)
 * for (const { route, handler } of createExamTypesRouteMap(examTypesHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export { listExamTypesRoute, getExamTypeRoute, listChildExamTypesRoute } from './exam-types.routes'

export type {
  ListExamTypesRoute,
  GetExamTypeRoute,
  ListChildExamTypesRoute,
} from './exam-types.routes'

export { createExamTypesHandlers, createExamTypesRouteMap } from './exam-types.handlers'

export { createExamTypesRepository, type ExamTypesRepository } from './exam-types.repository'

export {
  createExamTypesService,
  ExamTypeNotFoundError,
  type ExamTypesService,
} from './exam-types.service'

export type { ExamTypeView, ExamTypeListQuery, ChildExamTypeListQuery } from './exam-types.types'
