/**
 * @module purchases.repository
 *
 * Database operations for the purchases feature module.
 */

import { eq, and, desc, lt, isNull, sql } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users } from '@abugida/database/auth'
import { courses } from '@abugida/database/catalog'
import { purchases, purchaseOptions, paymentGateways } from '@abugida/database/finance'
import { enrollments } from '@abugida/database/learning'

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

export interface PurchaseRow {
  id: number
  publicId: string
  studentId: string
  courseId: number | null
  bundleId: number | null
  purchaseOptionId: number
  status: string | null
  amount: string
  currency: string
  completedAt: Date | null
  createdAt: Date
}

export interface PurchaseEnrollmentRow {
  enrollmentPublicId: string
}

// ── Repository interface ───────────────────────────────────────────────────

export interface PurchasesRepository {
  findUserIdByPublicId(publicId: string): Promise<string | undefined>
  findCourseIdByPublicId(coursePublicId: string): Promise<number | undefined>
  findCoursePurchaseOptions(courseId: number): Promise<PurchaseOptionRow[]>
  findPurchaseOptionByPublicId(publicId: string): Promise<PurchaseOptionRow | undefined>
  findActiveTelebirrGateway(): Promise<{ id: number } | undefined>
  findPurchasesByStudentId(
    studentId: string,
    opts: { cursor: string | undefined; limit: number; type: string | undefined },
  ): Promise<{ rows: PurchaseRow[]; hasMore: boolean }>
  findPurchaseByPublicId(publicId: string): Promise<PurchaseRow | undefined>
  findEnrollmentsByPurchaseId(purchaseId: number): Promise<PurchaseEnrollmentRow[]>
  createPurchase(data: {
    studentId: string
    courseId: number | null
    bundleId: number | null
    purchaseOptionId: number
    paymentGatewayId: number
    amount: string
    currency: string
  }): Promise<PurchaseRow>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createPurchasesRepository(db: DatabaseClient): PurchasesRepository {
  return {
    async findUserIdByPublicId(publicId) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, publicId))
        .limit(1)
      return row?.id
    },

    async findCourseIdByPublicId(coursePublicId) {
      const [row] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.publicId, coursePublicId))
        .limit(1)
      return row?.id
    },

    async findCoursePurchaseOptions(courseId) {
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
            eq(purchaseOptions.courseId, courseId),
            eq(purchaseOptions.isActive, true),
            isNull(purchaseOptions.deletedAt),
          ),
        )
        .orderBy(purchaseOptions.platform)
    },

    async findPurchaseOptionByPublicId(publicId) {
      const [row] = await db
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
        .where(and(eq(purchaseOptions.publicId, publicId), isNull(purchaseOptions.deletedAt)))
        .limit(1)
      return row
    },

    async findActiveTelebirrGateway() {
      const [row] = await db
        .select({ id: paymentGateways.id })
        .from(paymentGateways)
        .where(
          and(
            eq(paymentGateways.providerName, 'telebirr'),
            eq(paymentGateways.isEnabled, true),
            isNull(paymentGateways.deletedAt),
          ),
        )
        .limit(1)
      return row
    },

    async findPurchasesByStudentId(studentId, opts) {
      const { cursor, limit, type } = opts
      const effectiveLimit = limit + 1

      const conditions = [eq(purchases.studentId, studentId), isNull(purchases.deletedAt)]

      if (type === 'COURSE') {
        conditions.push(sql`${purchases.courseId} IS NOT NULL`)
      } else if (type === 'BUNDLE') {
        conditions.push(sql`${purchases.bundleId} IS NOT NULL`)
      }

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(purchases.id, cursorId))
      }

      const rows = await db
        .select({
          id: purchases.id,
          publicId: purchases.publicId,
          studentId: purchases.studentId,
          courseId: purchases.courseId,
          bundleId: purchases.bundleId,
          purchaseOptionId: purchases.purchaseOptionId,
          status: purchases.status,
          amount: purchases.amount,
          currency: purchases.currency,
          completedAt: purchases.completedAt,
          createdAt: purchases.createdAt,
        })
        .from(purchases)
        .where(and(...conditions))
        .orderBy(desc(purchases.createdAt), desc(purchases.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async findPurchaseByPublicId(publicId) {
      const [row] = await db
        .select({
          id: purchases.id,
          publicId: purchases.publicId,
          studentId: purchases.studentId,
          courseId: purchases.courseId,
          bundleId: purchases.bundleId,
          purchaseOptionId: purchases.purchaseOptionId,
          status: purchases.status,
          amount: purchases.amount,
          currency: purchases.currency,
          completedAt: purchases.completedAt,
          createdAt: purchases.createdAt,
        })
        .from(purchases)
        .where(and(eq(purchases.publicId, publicId), isNull(purchases.deletedAt)))
        .limit(1)
      return row
    },

    async findEnrollmentsByPurchaseId(purchaseId) {
      return db
        .select({ enrollmentPublicId: enrollments.publicId })
        .from(enrollments)
        .where(eq(enrollments.purchaseId, purchaseId))
    },

    async createPurchase(data) {
      const [row] = await db
        .insert(purchases)
        .values({
          studentId: data.studentId,
          courseId: data.courseId,
          bundleId: data.bundleId,
          purchaseOptionId: data.purchaseOptionId,
          paymentGatewayId: data.paymentGatewayId,
          amount: data.amount,
          currency: data.currency,
          status: 'initiated',
        })
        .returning({
          id: purchases.id,
          publicId: purchases.publicId,
          studentId: purchases.studentId,
          courseId: purchases.courseId,
          bundleId: purchases.bundleId,
          purchaseOptionId: purchases.purchaseOptionId,
          status: purchases.status,
          amount: purchases.amount,
          currency: purchases.currency,
          completedAt: purchases.completedAt,
          createdAt: purchases.createdAt,
        })
      return row!
    },
  }
}

export { encodeCursor, decodeCursor }
