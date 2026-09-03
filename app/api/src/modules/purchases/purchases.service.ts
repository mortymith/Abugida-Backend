/**
 * @module purchases.service
 *
 * Business logic for the purchases feature module.
 */

import type { PurchasesRepository } from './purchases.repository'
import type { PurchaseOptionRow, PurchaseRow } from './purchases.repository'
import { encodeCursor } from './purchases.repository'
import type {
  PurchaseOptionView,
  PurchaseView,
  PurchaseListQuery,
  PurchaseInitiateBody,
} from './purchases.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class PurchaseOptionNotFoundError extends Error {
  constructor(message = 'Purchase option not found.') {
    super(message)
    this.name = 'PurchaseOptionNotFoundError'
  }
}

export class PurchaseNotFoundError extends Error {
  constructor(message = 'Purchase not found.') {
    super(message)
    this.name = 'PurchaseNotFoundError'
  }
}

export class InvalidPurchaseRequestError extends Error {
  constructor(message = 'Invalid purchase request.') {
    super(message)
    this.name = 'InvalidPurchaseRequestError'
  }
}

export class ConflictPurchaseError extends Error {
  constructor(message = 'A purchase is already in progress for this item.') {
    super(message)
    this.name = 'ConflictPurchaseError'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toPurchaseOptionView(row: PurchaseOptionRow): PurchaseOptionView {
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

function toPurchaseView(row: PurchaseRow, enrollmentIds: string[]): PurchaseView {
  return {
    id: row.publicId,
    courseId: row.courseId ? String(row.courseId) : null,
    bundleId: row.bundleId ? String(row.bundleId) : null,
    purchaseOptionId: String(row.purchaseOptionId),
    status: (row.status ?? 'initiated').toUpperCase(),
    amount: { amount: row.amount, currency: row.currency },
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    enrollments: enrollmentIds,
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface PurchasesService {
  getCoursePurchaseOptions(coursePublicId: string): Promise<{ data: PurchaseOptionView[] }>
  listPurchases(
    userPublicId: string,
    query: PurchaseListQuery,
  ): Promise<{
    data: PurchaseView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  initiatePurchase(userPublicId: string, body: PurchaseInitiateBody): Promise<PurchaseView>
  getPurchase(userPublicId: string, purchasePublicId: string): Promise<PurchaseView>
}

export function createPurchasesService(repo: PurchasesRepository): PurchasesService {
  return {
    async getCoursePurchaseOptions(coursePublicId) {
      const courseId = await repo.findCourseIdByPublicId(coursePublicId)
      if (!courseId) throw new PurchaseOptionNotFoundError('Course not found.')

      const optionRows = await repo.findCoursePurchaseOptions(courseId)
      return {
        data: optionRows.map(toPurchaseOptionView),
      }
    },

    async listPurchases(userPublicId, query) {
      const userId = await repo.findUserIdByPublicId(userPublicId)
      if (!userId) throw new PurchaseNotFoundError('User not found.')

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findPurchasesByStudentId(userId, {
        cursor: query.cursor,
        limit,
        type: query.type,
      })

      const lastRow = rows[rows.length - 1]
      return {
        data: rows.map((row) => toPurchaseView(row, [])),
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async initiatePurchase(userPublicId, body) {
      const userId = await repo.findUserIdByPublicId(userPublicId)
      if (!userId) throw new InvalidPurchaseRequestError('User not found.')

      const option = await repo.findPurchaseOptionByPublicId(body.purchaseOptionId)
      if (!option) throw new PurchaseOptionNotFoundError()
      if (!option.isActive)
        throw new InvalidPurchaseRequestError('Purchase option is no longer active.')

      // Validate XOR: exactly one of courseId or bundleId
      const hasCourse = !!body.courseId
      const hasBundle = !!body.bundleId
      if (hasCourse === hasBundle) {
        throw new InvalidPurchaseRequestError(
          'Exactly one of courseId or bundleId must be provided.',
        )
      }

      // Validate the purchase option matches the requested item
      if (hasCourse && option.courseId === null) {
        throw new InvalidPurchaseRequestError(
          'Purchase option does not match the requested course.',
        )
      }
      if (hasBundle && option.bundleId === null) {
        throw new InvalidPurchaseRequestError(
          'Purchase option does not match the requested bundle.',
        )
      }

      // Resolve the active Telebirr gateway (server-side, not client-provided)
      const gateway = await repo.findActiveTelebirrGateway()
      if (!gateway) {
        throw new InvalidPurchaseRequestError('Payment gateway is not available.')
      }

      const purchase = await repo.createPurchase({
        studentId: userId,
        courseId: option.courseId,
        bundleId: option.bundleId,
        purchaseOptionId: option.id,
        paymentGatewayId: gateway.id,
        amount: option.priceAmount,
        currency: option.priceCurrency,
      })

      return toPurchaseView(purchase, [])
    },

    async getPurchase(userPublicId, purchasePublicId) {
      const userId = await repo.findUserIdByPublicId(userPublicId)
      if (!userId) throw new PurchaseNotFoundError('User not found.')

      const row = await repo.findPurchaseByPublicId(purchasePublicId)
      if (!row) throw new PurchaseNotFoundError()
      if (row.studentId !== userId) throw new PurchaseNotFoundError()

      const enrollmentRows = await repo.findEnrollmentsByPurchaseId(row.id)
      return toPurchaseView(
        row,
        enrollmentRows.map((e) => e.enrollmentPublicId),
      )
    },
  }
}
