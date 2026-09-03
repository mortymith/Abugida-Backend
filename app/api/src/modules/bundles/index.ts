/**
 * @module bundles
 *
 * Bundles feature module — course bundle browsing, details, and search.
 *
 * Usage in app.ts:
 * ```ts
 * import { createBundlesHandlers, createBundlesRouteMap, createBundlesRepository, createBundlesService } from './modules/bundles'
 *
 * const bundlesRepo = createBundlesRepository(db)
 * const bundlesService = createBundlesService(bundlesRepo)
 * const bundlesHandlers = createBundlesHandlers(bundlesService)
 * for (const { route, handler } of createBundlesRouteMap(bundlesHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  listBundlesRoute,
  getBundleRoute,
  listBundleCoursesRoute,
  getBundlePurchaseOptionsRoute,
  listBundlesByExamTypeRoute,
  searchBundlesRoute,
} from './bundles.routes'

export type {
  ListBundlesRoute,
  GetBundleRoute,
  ListBundleCoursesRoute,
  GetBundlePurchaseOptionsRoute,
  ListBundlesByExamTypeRoute,
  SearchBundlesRoute,
} from './bundles.routes'

export { createBundlesHandlers, createBundlesRouteMap } from './bundles.handlers'

export { createBundlesRepository, type BundlesRepository } from './bundles.repository'

export {
  createBundlesService,
  BundleNotFoundError,
  BundleGoneError,
  type BundlesService,
} from './bundles.service'

export type {
  BundleView,
  BundleCourseItemView,
  PurchaseOptionView,
  BundleListQuery,
  BundleSearchQuery,
  BundleByExamTypeQuery,
} from './bundles.types'
