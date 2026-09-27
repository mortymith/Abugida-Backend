/**
 * Server-only implementation of S-8.3 Discount & Coupon Codes: percentage /
 * fixed / full-access codes scoped to courses, usage limits and expiry,
 * single-use batch generation with CSV export data, per-code revenue
 * influence from completed purchases, and redemption history. Validation
 * lives here — percentage 1-99, positive fixed amounts, future expiry, and
 * duplicate-code rejection are enforced server-side. Never import from
 * client code.
 */
import { and, count, desc, eq, gte, inArray, isNull, sql } from '@abugida/database'
import { couponCourses, couponRedemptions, coupons } from '@abugida/database/marketing'
import { courses } from '@abugida/database/catalog'
import { purchases } from '@abugida/database/finance'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireMarketingReadRole,
  requireMarketingWriteRole,
  writeMarketingAudit,
} from './marketing.server-helpers.server'
import { generateCouponCodes, MAX_BATCH_SIZE, normalizeCouponCode } from '../marketing.coupon-codes'
import type {
  CouponBatchInput,
  CouponCreateInput,
  CouponPublicIdInput,
  CouponUpdateInput,
} from '../schemas/marketing.schema'
import type { CouponRedemptionRow, CouponRow, CouponStateValue } from '../marketing.types'

function couponState(
  isActive: boolean,
  expiresAt: Date | null,
  maxRedemptions: number | null,
  redemptionCount: number,
): CouponStateValue {
  if (!isActive) return 'deactivated'
  if (expiresAt != null && expiresAt.getTime() <= Date.now()) return 'expired'
  if (maxRedemptions != null && redemptionCount >= maxRedemptions) return 'exhausted'
  return 'active'
}

async function resolveCoupon(couponPublicId: string) {
  const rows = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.publicId, couponPublicId), isNull(coupons.deletedAt)))
    .limit(1)
  const coupon = rows.at(0)
  if (!coupon) throw new Error('COUPON_NOT_FOUND')
  return coupon
}

async function listCouponRows(publicId?: string): Promise<CouponRow[]> {
  const redemptionAgg = db
    .select({
      couponId: couponRedemptions.couponId,
      redemptions: count().as('redemption_count'),
    })
    .from(couponRedemptions)
    .groupBy(couponRedemptions.couponId)
    .as('redemption_agg')

  const revenueAgg = db
    .select({
      couponId: couponRedemptions.couponId,
      revenue: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`.as('revenue_influenced'),
    })
    .from(couponRedemptions)
    .innerJoin(
      purchases,
      and(eq(purchases.id, couponRedemptions.purchaseId), eq(purchases.status, 'completed')),
    )
    .groupBy(couponRedemptions.couponId)
    .as('revenue_agg')

  const rows = await db
    .select({
      publicId: coupons.publicId,
      code: coupons.code,
      kind: coupons.kind,
      value: coupons.value,
      currency: coupons.currency,
      maxRedemptions: coupons.maxRedemptions,
      expiresAt: coupons.expiresAt,
      stackable: coupons.stackable,
      isActive: coupons.isActive,
      batchId: coupons.batchId,
      batchLabel: coupons.batchLabel,
      createdAt: coupons.createdAt,
      redemptions: redemptionAgg.redemptions,
      revenue: revenueAgg.revenue,
    })
    .from(coupons)
    .leftJoin(redemptionAgg, eq(redemptionAgg.couponId, coupons.id))
    .leftJoin(revenueAgg, eq(revenueAgg.couponId, coupons.id))
    .where(
      publicId
        ? and(eq(coupons.publicId, publicId), isNull(coupons.deletedAt))
        : isNull(coupons.deletedAt),
    )
    .orderBy(desc(coupons.createdAt))
    .limit(publicId ? 1 : 200)

  const publicIds = rows.map((row) => row.publicId)
  const scopeRows =
    publicIds.length > 0
      ? await db
          .select({
            couponPublicId: coupons.publicId,
            coursePublicId: courses.publicId,
            courseTitle: courses.title,
          })
          .from(couponCourses)
          .innerJoin(coupons, eq(coupons.id, couponCourses.couponId))
          .innerJoin(courses, eq(courses.id, couponCourses.courseId))
          .where(inArray(coupons.publicId, publicIds))
      : []

  const scopeByCoupon = new Map<string, Array<{ publicId: string; title: string }>>()
  for (const scopeRow of scopeRows) {
    const list = scopeByCoupon.get(scopeRow.couponPublicId) ?? []
    list.push({ publicId: scopeRow.coursePublicId, title: scopeRow.courseTitle })
    scopeByCoupon.set(scopeRow.couponPublicId, list)
  }

  return rows.map((row) => {
    const redemptionCount = Number(row.redemptions)
    return {
      publicId: row.publicId,
      code: row.code,
      kind: row.kind,
      value: row.value == null ? null : Number(row.value),
      currency: row.currency,
      scope: scopeByCoupon.get(row.publicId) ?? [],
      maxRedemptions: row.maxRedemptions,
      redemptionCount,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      stackable: row.stackable,
      isActive: row.isActive,
      state: couponState(row.isActive, row.expiresAt, row.maxRedemptions, redemptionCount),
      revenueInfluenced: Number(row.revenue),
      batchId: row.batchId,
      batchLabel: row.batchLabel,
      createdAt: row.createdAt.toISOString(),
    }
  })
}

export async function listCouponsImpl(query: { status?: string }): Promise<{ items: CouponRow[] }> {
  await requireMarketingReadRole()
  const items = await listCouponRows()
  return {
    items:
      query.status && query.status !== 'all'
        ? items.filter((item) => item.state === query.status)
        : items,
  }
}

async function resolveScopeCourseIds(scopeCoursePublicIds: string[]): Promise<number[]> {
  if (scopeCoursePublicIds.length === 0) return []
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(inArray(courses.publicId, scopeCoursePublicIds))
  return rows.map((row) => row.id)
}

async function insertScope(courseIds: number[], couponId: number): Promise<void> {
  if (courseIds.length === 0) return
  await db
    .insert(couponCourses)
    .values(courseIds.map((courseId) => ({ couponId, courseId })))
    .onConflictDoNothing()
}

export async function createCouponImpl(
  input: CouponCreateInput,
): Promise<{ couponPublicIds: string[]; codes: string[] }> {
  const userId = await requireMarketingWriteRole()

  const generated = generateCouponCodes(1)
  const code = normalizeCouponCode(input.code ?? generated[0])
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new Error('INVALID_EXPIRY:Expiry must be in the future')
  }

  const courseIds = await resolveScopeCourseIds(input.scopeCoursePublicIds)

  // Fixed-amount codes must stay below every scoped paid course's price.
  if (input.kind === 'fixed' && courseIds.length > 0) {
    const priceRows = await db
      .select({ id: courses.id, priceAmount: courses.priceAmount, isFree: courses.isFree })
      .from(courses)
      .where(inArray(courses.id, courseIds))
    for (const price of priceRows) {
      if (price.isFree) continue
      if (Number(price.priceAmount) <= (input.value ?? 0)) {
        throw new Error(
          'INVALID_AMOUNT:Fixed discount must be smaller than the scoped course price',
        )
      }
    }
  }

  const inserted = await db
    .insert(coupons)
    .values({
      code,
      kind: input.kind,
      value: input.kind === 'full_access' ? null : String(input.value ?? 0),
      currency: 'ETB',
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt,
      stackable: input.stackable,
      isActive: true,
      createdBy: userId,
    })
    .onConflictDoNothing({ target: coupons.code })
    .returning({ publicId: coupons.publicId, id: coupons.id })

  const created = inserted.at(0)
  if (!created) throw new Error('DUPLICATE_CODE:That code already exists')

  await insertScope(courseIds, created.id)
  await writeMarketingAudit({
    actorId: userId,
    entity: 'coupon',
    action: 'create',
    entityPublicId: created.publicId,
    metadata: { code, kind: input.kind },
  })

  return { couponPublicIds: [created.publicId], codes: [code] }
}

export async function generateCouponBatchImpl(
  input: CouponBatchInput,
): Promise<{ codes: string[]; couponPublicIds: string[]; expiresAt: string | null }> {
  const userId = await requireMarketingWriteRole()
  if (input.count < 1 || input.count > MAX_BATCH_SIZE) {
    throw new Error(`INVALID_BATCH_SIZE:Count must be between 1 and ${MAX_BATCH_SIZE}`)
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new Error('INVALID_EXPIRY:Expiry must be in the future')
  }

  const codes = generateCouponCodes(input.count, { prefix: input.prefix })
  const courseIds = await resolveScopeCourseIds(input.scopeCoursePublicIds)

  const batchId = crypto.randomUUID()
  const inserted = await db
    .insert(coupons)
    .values(
      codes.map((code) => ({
        code,
        kind: input.kind,
        value: input.kind === 'full_access' ? null : String(input.value ?? 0),
        currency: 'ETB',
        maxRedemptions: 1,
        expiresAt,
        stackable: input.stackable,
        isActive: true,
        batchId,
        batchLabel: input.batchLabel ?? `Batch of ${input.count}`,
        createdBy: userId,
      })),
    )
    .onConflictDoNothing({ target: coupons.code })
    .returning({ publicId: coupons.publicId, id: coupons.id })

  if (inserted.length === 0) throw new Error('BATCH_FAILED:Codes could not be created')
  if (courseIds.length > 0) {
    await db
      .insert(couponCourses)
      .values(
        inserted.flatMap((row) => courseIds.map((courseId) => ({ couponId: row.id, courseId }))),
      )
      .onConflictDoNothing()
  }

  await writeMarketingAudit({
    actorId: userId,
    entity: 'coupon',
    action: 'generate_batch',
    metadata: { count: inserted.length, batchId, kind: input.kind },
  })

  return {
    codes: inserted.map((_, index) => codes[index] ?? ''),
    couponPublicIds: inserted.map((row) => row.publicId),
    expiresAt: expiresAt?.toISOString() ?? null,
  }
}

export async function updateCouponImpl(input: CouponUpdateInput): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const coupon = await resolveCoupon(input.couponPublicId)

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new Error('INVALID_EXPIRY:Expiry must be in the future')
  }

  await db
    .update(coupons)
    .set({
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, coupon.id))

  await writeMarketingAudit({
    actorId: userId,
    entity: 'coupon',
    action: input.isActive === false ? 'deactivate' : 'update',
    entityPublicId: coupon.publicId,
    metadata: {
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
    },
  })
  return { ok: true }
}

export async function getCouponRedemptionsImpl(
  input: CouponPublicIdInput,
): Promise<{ items: CouponRedemptionRow[] }> {
  await requireMarketingReadRole()
  const coupon = await resolveCoupon(input.couponPublicId)

  const rows = await db
    .select({
      publicId: couponRedemptions.publicId,
      studentName: users.name,
      courseTitle: courses.title,
      amountDiscounted: couponRedemptions.amountDiscounted,
      currency: couponRedemptions.currency,
      createdAt: couponRedemptions.createdAt,
    })
    .from(couponRedemptions)
    .leftJoin(users, eq(users.id, couponRedemptions.userId))
    .leftJoin(purchases, eq(purchases.id, couponRedemptions.purchaseId))
    .leftJoin(courses, eq(courses.id, purchases.courseId))
    .where(eq(couponRedemptions.couponId, coupon.id))
    .orderBy(desc(couponRedemptions.createdAt))
    .limit(200)

  return {
    items: rows.map((row) => ({
      id: row.publicId,
      studentName: row.studentName ?? 'Unknown student',
      courseTitle: row.courseTitle ?? null,
      amountDiscounted: Number(row.amountDiscounted),
      currency: row.currency,
      redeemedAt: row.createdAt.toISOString(),
    })),
  }
}

/** Redemptions in the last 24h — drives the S-7.1 deactivation warning. */
export async function countRecentRedemptionsImpl(
  input: CouponPublicIdInput,
): Promise<{ count: number }> {
  await requireMarketingReadRole()
  const coupon = await resolveCoupon(input.couponPublicId)
  const rows = await db
    .select({ total: count() })
    .from(couponRedemptions)
    .where(
      and(
        eq(couponRedemptions.couponId, coupon.id),
        gte(couponRedemptions.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ),
    )
  return { count: Number(rows.at(0)?.total ?? 0) }
}
