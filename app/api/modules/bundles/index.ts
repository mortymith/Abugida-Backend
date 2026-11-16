/**
 * @module bundles
 *
 * Bundles feature module — course bundle browsing, details, and search.
 *
 * Usage in app.ts:
 * ```ts
 * import { createBundlesHandlers, createBundlesRouteMap, createBundlesRepository, createBundlesService } from '#/modules/bundles'
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
} from '#/modules/bundles/bundles.routes'

export type {
  ListBundlesRoute,
  GetBundleRoute,
  ListBundleCoursesRoute,
  GetBundlePurchaseOptionsRoute,
  ListBundlesByExamTypeRoute,
  SearchBundlesRoute,
} from '#/modules/bundles/bundles.routes'

export { createBundlesHandlers, createBundlesRouteMap } from '#/modules/bundles/bundles.handlers'

export {
  createBundlesRepository,
  type BundlesRepository,
} from '#/modules/bundles/bundles.repository'

export {
  createBundlesService,
  BundleNotFoundError,
  BundleGoneError,
  type BundlesService,
} from '#/modules/bundles/bundles.service'

export type {
  BundleView,
  BundleCourseItemView,
  PurchaseOptionView,
  BundleListQuery,
  BundleSearchQuery,
  BundleByExamTypeQuery,
} from '#/modules/bundles/bundles.types'
