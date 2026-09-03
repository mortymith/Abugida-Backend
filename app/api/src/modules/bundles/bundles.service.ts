/**
 * @module bundles.service
 *
 * Business logic for the bundles feature module.
 */

import type { BundlesRepository } from './bundles.repository'
import type { BundleRow } from './bundles.repository'
import { encodeCursor } from './bundles.repository'
import type {
  BundleView,
  BundleCourseItemView,
  PurchaseOptionView,
  BundleListQuery,
  BundleSearchQuery,
  BundleByExamTypeQuery,
} from './bundles.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class BundleNotFoundError extends Error {
  constructor(message = 'Bundle not found.') {
    super(message)
    this.name = 'BundleNotFoundError'
  }
}

export class BundleGoneError extends Error {
  constructor(message = 'Bundle is no longer available.') {
    super(message)
    this.name = 'BundleGoneError'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toBundleView(row: BundleRow): BundleView {
  return {
    id: row.publicId,
    examTypeId: String(row.examTypeId),
    title: row.title,
    slug: row.slug,
    description: row.description,
    thumbnailUrl: row.thumbnailObjectKey ? `/objects/${row.thumbnailObjectKey}` : null,
    price: { amount: row.priceAmount, currency: row.priceCurrency },
    originalPrice: { amount: row.originalPriceAmount, currency: row.priceCurrency },
    discountPercentage: Number.parseFloat(row.discountPercentage),
    status: (row.status ?? 'draft').toUpperCase(),
    courseCount: row.courseCount ?? 0,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function toBundleCourseItemView(row: {
  courseId: string
  title: string
  slug: string
  thumbnailObjectKey: string | null
  priceAmount: string | null
  priceCurrency: string
  sortOrder: number
}): BundleCourseItemView {
  return {
    courseId: row.courseId,
    title: row.title,
    slug: row.slug,
    thumbnailUrl: row.thumbnailObjectKey ? `/objects/${row.thumbnailObjectKey}` : null,
    individualPrice: { amount: row.priceAmount ?? '0', currency: row.priceCurrency },
    sortOrder: row.sortOrder,
  }
}

function toPurchaseOptionView(row: {
  publicId: string
  courseId: number | null
  bundleId: number | null
  platform: string | null
  productId: string
  displayName: string
  description: string | null
  durationDays: number
  priceAmount: string
  priceCurrency: string
  isActive: boolean
}): PurchaseOptionView {
  return {
    id: row.publicId,
    courseId: row.courseId ? String(row.courseId) : null,
    bundleId: row.bundleId ? String(row.bundleId) : null,
    platform: (row.platform ?? 'web').toUpperCase(),
    productId: row.productId,
    displayName: row.displayName,
    description: row.description,
    durationDays: row.durationDays,
    price: { amount: row.priceAmount, currency: row.priceCurrency },
    isActive: row.isActive,
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface BundlesService {
  listBundles(query: BundleListQuery): Promise<{
    data: BundleView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  getBundle(bundleId: string): Promise<BundleView>
  listBundleCourses(bundleId: string): Promise<{ data: BundleCourseItemView[] }>
  getBundlePurchaseOptions(bundleId: string): Promise<{ data: PurchaseOptionView[] }>
  listBundlesByExamType(query: BundleByExamTypeQuery): Promise<{
    data: BundleView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  searchBundles(query: BundleSearchQuery): Promise<{
    data: BundleView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
}

export function createBundlesService(repo: BundlesRepository): BundlesService {
  return {
    async listBundles(query) {
      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findPublished({
        cursor: query.cursor,
        limit,
        sort: query.sort ?? 'newest',
      })

      const lastRow = rows[rows.length - 1]
      return {
        data: rows.map(toBundleView),
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async getBundle(bundleId) {
      const row = await repo.findByPublicId(bundleId)
      if (!row) throw new BundleNotFoundError()
      if (row.status !== 'published') throw new BundleGoneError()
      return toBundleView(row)
    },

    async listBundleCourses(bundleId) {
      const row = await repo.findByPublicId(bundleId)
      if (!row) throw new BundleNotFoundError()

      const courseRows = await repo.findCoursesByBundleId(row.id)
      return {
        data: courseRows.map(toBundleCourseItemView),
      }
    },

    async getBundlePurchaseOptions(bundleId) {
      const row = await repo.findByPublicId(bundleId)
      if (!row) throw new BundleNotFoundError()

      const optionRows = await repo.findPurchaseOptionsByBundleId(row.id)
      return {
        data: optionRows.map(toPurchaseOptionView),
      }
    },

    async listBundlesByExamType(query) {
      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findPublishedByExamTypeId(query.examTypeId, {
        cursor: query.cursor,
        limit,
      })

      const lastRow = rows[rows.length - 1]
      return {
        data: rows.map(toBundleView),
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async searchBundles(query) {
      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.searchBundles({
        q: query.q,
        examType: query.examType,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        sort: query.sort ?? 'relevance',
        cursor: query.cursor,
        limit,
      })

      const lastRow = rows[rows.length - 1]
      return {
        data: rows.map(toBundleView),
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },
  }
}
