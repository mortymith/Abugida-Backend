/**
 * @module bundles.repository
 *
 * Database operations for the bundles feature module.
 */

import { eq, and, desc, asc, lt, isNull, sql, gte, lte, like, or } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { courseBundles, bundleCourses, courses, examTypes } from '@abugida/database/catalog'
import { purchaseOptions } from '@abugida/database/finance'

// ── Cursor helpers ─────────────────────────────────────────────────────────

function encodeCursor(id: number): string {
  return Buffer.from(`cursor:${id}`).toString('base64url')
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
  const match = decoded.match(/^cursor:(\d+)$/)
  if (!match?.[1]) throw new Error('Invalid cursor format')
  return Number.parseInt(match[1], 10)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface BundleRow {
  id: number
  publicId: string
  examTypeId: number
  title: string
  slug: string
  description: string | null
  thumbnailObjectKey: string | null
  priceAmount: string
  priceCurrency: string
  originalPriceAmount: string
  discountPercentage: string
  status: string | null
  publishedAt: Date | null
  createdAt: Date
  courseCount?: number
}

export interface BundleCourseRow {
  courseId: string
  title: string
  slug: string
  thumbnailObjectKey: string | null
  priceAmount: string | null
  priceCurrency: string
  sortOrder: number
}

export interface PurchaseOptionRow {
  id: number
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
}

// ── Repository interface ───────────────────────────────────────────────────

export interface BundlesRepository {
  findPublished(opts: {
    cursor: string | undefined
    limit: number
    sort: string
  }): Promise<{ rows: BundleRow[]; hasMore: boolean }>
  findByPublicId(publicId: string): Promise<BundleRow | undefined>
  findCoursesByBundleId(bundleId: number): Promise<BundleCourseRow[]>
  findPurchaseOptionsByBundleId(bundleId: number): Promise<PurchaseOptionRow[]>
  findPublishedByExamTypeId(
    examTypeId: string,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: BundleRow[]; hasMore: boolean }>
  searchBundles(opts: {
    q: string | undefined
    examType: string | undefined
    minPrice: number | undefined
    maxPrice: number | undefined
    sort: string
    cursor: string | undefined
    limit: number
  }): Promise<{ rows: BundleRow[]; hasMore: boolean }>
  countBundleCourses(bundleId: number): Promise<number>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createBundlesRepository(db: DatabaseClient): BundlesRepository {
  return {
    async findPublished(opts) {
      const { cursor, limit, sort } = opts
      const effectiveLimit = limit + 1

      const conditions = [eq(courseBundles.status, 'published'), isNull(courseBundles.deletedAt)]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(courseBundles.id, cursorId))
      }

      const orderClause = (() => {
        switch (sort) {
          case 'price_low':
            return [asc(courseBundles.priceAmount), desc(courseBundles.id)]
          case 'price_high':
            return [desc(courseBundles.priceAmount), desc(courseBundles.id)]
          case 'discount':
            return [desc(courseBundles.discountPercentage), desc(courseBundles.id)]
          default:
            return [desc(courseBundles.createdAt), desc(courseBundles.id)]
        }
      })()

      const rows = await db
        .select({
          id: courseBundles.id,
          publicId: courseBundles.publicId,
          examTypeId: courseBundles.examTypeId,
          title: courseBundles.title,
          slug: courseBundles.slug,
          description: courseBundles.description,
          thumbnailObjectKey: courseBundles.thumbnailObjectKey,
          priceAmount: courseBundles.priceAmount,
          priceCurrency: courseBundles.priceCurrency,
          originalPriceAmount: courseBundles.originalPriceAmount,
          discountPercentage: courseBundles.discountPercentage,
          status: courseBundles.status,
          publishedAt: courseBundles.publishedAt,
          createdAt: courseBundles.createdAt,
          courseCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${bundleCourses}
            WHERE ${bundleCourses.bundleId} = ${courseBundles.id}
              AND ${bundleCourses.isIncluded} = true
          )`,
        })
        .from(courseBundles)
        .where(and(...conditions))
        .orderBy(...orderClause)
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async findByPublicId(publicId) {
      const [row] = await db
        .select({
          id: courseBundles.id,
          publicId: courseBundles.publicId,
          examTypeId: courseBundles.examTypeId,
          title: courseBundles.title,
          slug: courseBundles.slug,
          description: courseBundles.description,
          thumbnailObjectKey: courseBundles.thumbnailObjectKey,
          priceAmount: courseBundles.priceAmount,
          priceCurrency: courseBundles.priceCurrency,
          originalPriceAmount: courseBundles.originalPriceAmount,
          discountPercentage: courseBundles.discountPercentage,
          status: courseBundles.status,
          publishedAt: courseBundles.publishedAt,
          createdAt: courseBundles.createdAt,
          courseCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${bundleCourses}
            WHERE ${bundleCourses.bundleId} = ${courseBundles.id}
              AND ${bundleCourses.isIncluded} = true
          )`,
        })
        .from(courseBundles)
        .where(and(eq(courseBundles.publicId, publicId), isNull(courseBundles.deletedAt)))
        .limit(1)
      return row
    },

    async findCoursesByBundleId(bundleId) {
      return db
        .select({
          courseId: sql<string>`${courses.publicId}`,
          title: courses.title,
          slug: courses.slug,
          thumbnailObjectKey: courses.thumbnailObjectKey,
          priceAmount: courses.priceAmount,
          priceCurrency: courses.priceCurrency,
          sortOrder: bundleCourses.sortOrder,
        })
        .from(bundleCourses)
        .innerJoin(courses, eq(bundleCourses.courseId, courses.id))
        .where(and(eq(bundleCourses.bundleId, bundleId), eq(bundleCourses.isIncluded, true)))
        .orderBy(bundleCourses.sortOrder, bundleCourses.id)
    },

    async findPurchaseOptionsByBundleId(bundleId) {
      return db
        .select({
          id: purchaseOptions.id,
          publicId: purchaseOptions.publicId,
          courseId: purchaseOptions.courseId,
          bundleId: purchaseOptions.bundleId,
          platform: purchaseOptions.platform,
          productId: purchaseOptions.productId,
          displayName: purchaseOptions.displayName,
          description: purchaseOptions.description,
          durationDays: purchaseOptions.durationDays,
          priceAmount: purchaseOptions.priceAmount,
          priceCurrency: purchaseOptions.priceCurrency,
          isActive: purchaseOptions.isActive,
        })
        .from(purchaseOptions)
        .where(
          and(
            eq(purchaseOptions.bundleId, bundleId),
            eq(purchaseOptions.isActive, true),
            isNull(purchaseOptions.deletedAt),
          ),
        )
        .orderBy(purchaseOptions.platform)
    },

    async findPublishedByExamTypeId(examTypeId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const examTypeRow = await db
        .select({ id: examTypes.id })
        .from(examTypes)
        .where(and(eq(examTypes.publicId, examTypeId), isNull(examTypes.deletedAt)))
        .limit(1)

      if (!examTypeRow[0]) {
        return { rows: [], hasMore: false }
      }

      const conditions = [
        eq(courseBundles.examTypeId, examTypeRow[0].id),
        eq(courseBundles.status, 'published'),
        isNull(courseBundles.deletedAt),
      ]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(courseBundles.id, cursorId))
      }

      const rows = await db
        .select({
          id: courseBundles.id,
          publicId: courseBundles.publicId,
          examTypeId: courseBundles.examTypeId,
          title: courseBundles.title,
          slug: courseBundles.slug,
          description: courseBundles.description,
          thumbnailObjectKey: courseBundles.thumbnailObjectKey,
          priceAmount: courseBundles.priceAmount,
          priceCurrency: courseBundles.priceCurrency,
          originalPriceAmount: courseBundles.originalPriceAmount,
          discountPercentage: courseBundles.discountPercentage,
          status: courseBundles.status,
          publishedAt: courseBundles.publishedAt,
          createdAt: courseBundles.createdAt,
          courseCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${bundleCourses}
            WHERE ${bundleCourses.bundleId} = ${courseBundles.id}
              AND ${bundleCourses.isIncluded} = true
          )`,
        })
        .from(courseBundles)
        .where(and(...conditions))
        .orderBy(desc(courseBundles.sortOrder), desc(courseBundles.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async searchBundles(opts) {
      const { q, examType, minPrice, maxPrice, sort, cursor, limit } = opts
      const effectiveLimit = limit + 1

      const conditions = [eq(courseBundles.status, 'published'), isNull(courseBundles.deletedAt)]

      if (q) {
        conditions.push(
          or(like(courseBundles.title, `%${q}%`), like(courseBundles.description, `%${q}%`))!,
        )
      }

      if (examType) {
        const examTypeRow = await db
          .select({ id: examTypes.id })
          .from(examTypes)
          .where(and(eq(examTypes.publicId, examType), isNull(examTypes.deletedAt)))
          .limit(1)
        if (examTypeRow[0]) {
          conditions.push(eq(courseBundles.examTypeId, examTypeRow[0].id))
        }
      }

      if (minPrice !== undefined) {
        conditions.push(gte(courseBundles.priceAmount, String(minPrice)))
      }
      if (maxPrice !== undefined) {
        conditions.push(lte(courseBundles.priceAmount, String(maxPrice)))
      }

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(courseBundles.id, cursorId))
      }

      const orderClause = (() => {
        switch (sort) {
          case 'price_low':
            return [asc(courseBundles.priceAmount), desc(courseBundles.id)]
          case 'price_high':
            return [desc(courseBundles.priceAmount), desc(courseBundles.id)]
          case 'discount':
            return [desc(courseBundles.discountPercentage), desc(courseBundles.id)]
          case 'newest':
            return [desc(courseBundles.createdAt), desc(courseBundles.id)]
          default:
            return [desc(courseBundles.createdAt), desc(courseBundles.id)]
        }
      })()

      const rows = await db
        .select({
          id: courseBundles.id,
          publicId: courseBundles.publicId,
          examTypeId: courseBundles.examTypeId,
          title: courseBundles.title,
          slug: courseBundles.slug,
          description: courseBundles.description,
          thumbnailObjectKey: courseBundles.thumbnailObjectKey,
          priceAmount: courseBundles.priceAmount,
          priceCurrency: courseBundles.priceCurrency,
          originalPriceAmount: courseBundles.originalPriceAmount,
          discountPercentage: courseBundles.discountPercentage,
          status: courseBundles.status,
          publishedAt: courseBundles.publishedAt,
          createdAt: courseBundles.createdAt,
          courseCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${bundleCourses}
            WHERE ${bundleCourses.bundleId} = ${courseBundles.id}
              AND ${bundleCourses.isIncluded} = true
          )`,
        })
        .from(courseBundles)
        .where(and(...conditions))
        .orderBy(...orderClause)
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async countBundleCourses(bundleId) {
      const [result] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(bundleCourses)
        .where(and(eq(bundleCourses.bundleId, bundleId), eq(bundleCourses.isIncluded, true)))
      return result?.count ?? 0
    },
  }
}

export { encodeCursor, decodeCursor }
