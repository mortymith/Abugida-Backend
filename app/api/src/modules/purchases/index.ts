/**
 * @module purchases
 *
 * Purchases feature module — Telebirr-only purchases for courses and bundles.
 *
 * Usage in app.ts:
 * ```ts
 * import { createPurchasesHandlers, createPurchasesRouteMap, createPurchasesRepository, createPurchasesService } from './modules/purchases'
 *
 * const purchasesRepo = createPurchasesRepository(db)
 * const purchasesService = createPurchasesService(purchasesRepo)
 * const purchasesHandlers = createPurchasesHandlers(purchasesService)
 * for (const { route, handler } of createPurchasesRouteMap(purchasesHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  getCoursePurchaseOptionsRoute,
  listPurchasesRoute,
  initiatePurchaseRoute,
  getPurchaseRoute,
} from './purchases.routes'

export type {
  GetCoursePurchaseOptionsRoute,
  ListPurchasesRoute,
  InitiatePurchaseRoute,
  GetPurchaseRoute,
} from './purchases.routes'

export { createPurchasesHandlers, createPurchasesRouteMap } from './purchases.handlers'

export { createPurchasesRepository, type PurchasesRepository } from './purchases.repository'

export {
  createPurchasesService,
  PurchaseOptionNotFoundError,
  PurchaseNotFoundError,
  InvalidPurchaseRequestError,
  ConflictPurchaseError,
  type PurchasesService,
} from './purchases.service'

export type {
  PurchaseOptionView,
  PurchaseView,
  PurchaseListQuery,
  PurchaseInitiateBody,
} from './purchases.types'
