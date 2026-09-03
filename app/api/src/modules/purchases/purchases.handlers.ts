/**
 * @module purchases.handlers
 *
 * Route handler implementations for the purchases feature module.
 */

import type { Context } from 'hono'
import type { PurchasesService } from './purchases.service'
import {
  PurchaseOptionNotFoundError,
  PurchaseNotFoundError,
  InvalidPurchaseRequestError,
  ConflictPurchaseError,
} from './purchases.service'
import type { AppEnv } from '@/middleware/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function notFound(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail,
      instance: c.req.path,
    } as const,
    404,
  )
}

function badRequest(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/invalid-parameter',
      title: 'Invalid Parameter',
      status: 400,
      detail,
      instance: c.req.path,
    } as const,
    400,
  )
}

function conflict(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/conflict',
      title: 'Conflict',
      status: 409,
      detail,
      instance: c.req.path,
    } as const,
    409,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createPurchasesHandlers(service: PurchasesService) {
  return {
    async getCoursePurchaseOptions(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      try {
        const result = await service.getCoursePurchaseOptions(courseId)
        return c.json(result, 200, {
          'X-Platform-Payment-Methods': '["telebirr"]',
        })
      } catch (error) {
        if (error instanceof PurchaseOptionNotFoundError) return notFound(c, 'Course not found.')
        throw error
      }
    },

    async listPurchases(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) {
        return c.json(
          {
            type: 'https://api.abugida.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required.',
            instance: c.req.path,
          } as const,
          401,
        )
      }

      const query = c.req.query()
      const result = await service.listPurchases(user.id, {
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        type: query.type,
      })
      return c.json(result, 200)
    },

    async initiatePurchase(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) {
        return c.json(
          {
            type: 'https://api.abugida.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required.',
            instance: c.req.path,
          } as const,
          401,
        )
      }

      try {
        const body = await c.req.json()
        const result = await service.initiatePurchase(user.id, body)
        return c.json({ data: result }, 201)
      } catch (error) {
        if (error instanceof PurchaseOptionNotFoundError)
          return notFound(c, 'Purchase option not found.')
        if (error instanceof InvalidPurchaseRequestError) return badRequest(c, error.message)
        if (error instanceof ConflictPurchaseError) return conflict(c, error.message)
        throw error
      }
    },

    async getPurchase(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) {
        return c.json(
          {
            type: 'https://api.abugida.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required.',
            instance: c.req.path,
          } as const,
          401,
        )
      }

      const purchaseId = c.req.param('purchaseId') as string
      try {
        const purchase = await service.getPurchase(user.id, purchaseId)
        return c.json({ data: purchase })
      } catch (error) {
        if (error instanceof PurchaseNotFoundError) return notFound(c, 'Purchase not found.')
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  getCoursePurchaseOptionsRoute,
  listPurchasesRoute,
  initiatePurchaseRoute,
  getPurchaseRoute,
} from './purchases.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createPurchasesRouteMap(handlers: ReturnType<typeof createPurchasesHandlers>) {
  return [
    {
      route: getCoursePurchaseOptionsRoute,
      handler: handlers.getCoursePurchaseOptions as AnyHandler,
    },
    { route: listPurchasesRoute, handler: handlers.listPurchases as AnyHandler },
    { route: initiatePurchaseRoute, handler: handlers.initiatePurchase as AnyHandler },
    { route: getPurchaseRoute, handler: handlers.getPurchase as AnyHandler },
  ] as const
}
