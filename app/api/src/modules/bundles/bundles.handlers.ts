/**
 * @module bundles.handlers
 *
 * Route handler implementations for the bundles feature module.
 */

import type { Context } from 'hono'
import type { BundlesService } from './bundles.service'
import { BundleNotFoundError, BundleGoneError } from './bundles.service'
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

function gone(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/gone',
      title: 'Gone',
      status: 410,
      detail,
      instance: c.req.path,
    } as const,
    410,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createBundlesHandlers(service: BundlesService) {
  return {
    async listBundles(c: Context<AppEnv>) {
      const query = c.req.query()
      const result = await service.listBundles({
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        sort: query.sort,
      })
      return c.json(result, 200)
    },

    async getBundle(c: Context<AppEnv>) {
      const bundleId = c.req.param('bundleId') as string
      try {
        const bundle = await service.getBundle(bundleId)
        return c.json({ data: bundle })
      } catch (error) {
        if (error instanceof BundleNotFoundError) return notFound(c, 'Bundle not found.')
        if (error instanceof BundleGoneError) return gone(c, 'Bundle is no longer available.')
        throw error
      }
    },

    async listBundleCourses(c: Context<AppEnv>) {
      const bundleId = c.req.param('bundleId') as string
      try {
        const result = await service.listBundleCourses(bundleId)
        return c.json(result)
      } catch (error) {
        if (error instanceof BundleNotFoundError) return notFound(c, 'Bundle not found.')
        throw error
      }
    },

    async getBundlePurchaseOptions(c: Context<AppEnv>) {
      const bundleId = c.req.param('bundleId') as string
      try {
        const result = await service.getBundlePurchaseOptions(bundleId)
        return c.json(result, 200, {
          'X-Platform-Payment-Methods': '["telebirr"]',
        })
      } catch (error) {
        if (error instanceof BundleNotFoundError) return notFound(c, 'Bundle not found.')
        throw error
      }
    },

    async listBundlesByExamType(c: Context<AppEnv>) {
      const examTypeId = c.req.param('examTypeId') as string
      const query = c.req.query()
      const result = await service.listBundlesByExamType({
        examTypeId,
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      })
      return c.json(result, 200)
    },

    async searchBundles(c: Context<AppEnv>) {
      const query = c.req.query()
      const result = await service.searchBundles({
        q: query.q,
        examType: query.exam_type,
        minPrice: query.min_price ? Number.parseFloat(query.min_price) : undefined,
        maxPrice: query.max_price ? Number.parseFloat(query.max_price) : undefined,
        sort: query.sort,
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      })
      return c.json(result, 200)
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  listBundlesRoute,
  getBundleRoute,
  listBundleCoursesRoute,
  getBundlePurchaseOptionsRoute,
  listBundlesByExamTypeRoute,
  searchBundlesRoute,
} from './bundles.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createBundlesRouteMap(handlers: ReturnType<typeof createBundlesHandlers>) {
  return [
    { route: listBundlesRoute, handler: handlers.listBundles as AnyHandler },
    { route: getBundleRoute, handler: handlers.getBundle as AnyHandler },
    { route: listBundleCoursesRoute, handler: handlers.listBundleCourses as AnyHandler },
    {
      route: getBundlePurchaseOptionsRoute,
      handler: handlers.getBundlePurchaseOptions as AnyHandler,
    },
    { route: listBundlesByExamTypeRoute, handler: handlers.listBundlesByExamType as AnyHandler },
    { route: searchBundlesRoute, handler: handlers.searchBundles as AnyHandler },
  ] as const
}
