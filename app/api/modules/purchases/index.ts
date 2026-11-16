/**
 * @module purchases
 *
 * Purchases feature module — Telebirr-only purchases for courses and bundles.
 *
 * Usage in app.ts:
 * ```ts
 * import { createPurchasesHandlers, createPurchasesRouteMap, createPurchasesRepository, createPurchasesService } from '#/modules/purchases'
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
} from '#/modules/purchases/purchases.routes'

export type {
  GetCoursePurchaseOptionsRoute,
  ListPurchasesRoute,
  InitiatePurchaseRoute,
  GetPurchaseRoute,
} from '#/modules/purchases/purchases.routes'

export {
  createPurchasesHandlers,
  createPurchasesRouteMap,
} from '#/modules/purchases/purchases.handlers'

export {
  createPurchasesRepository,
  type PurchasesRepository,
} from '#/modules/purchases/purchases.repository'

export {
  createPurchasesService,
  PurchaseOptionNotFoundError,
  PurchaseNotFoundError,
  InvalidPurchaseRequestError,
  ConflictPurchaseError,
  type PurchasesService,
} from '#/modules/purchases/purchases.service'

export type {
  PurchaseOptionView,
  PurchaseView,
  PurchaseListQuery,
  PurchaseInitiateBody,
} from '#/modules/purchases/purchases.types'
