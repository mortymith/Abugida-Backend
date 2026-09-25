/**
 * Server-only implementation of S-2.4 Pricing: course price fields,
 * discounts, and per-gateway purchase options (finance contract).
 */
import { and, eq, inArray, isNull } from '@abugida/database'
import { courses, courseDiscounts } from '@abugida/database/catalog'
import { paymentGateways, purchaseOptions } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import { requireAuthoringRole, resolveCourse } from './courses.server-helpers.server'
import {
  accessDaysForModel,
  accessLabelForModel,
  buildProductId,
  LIFETIME_ACCESS_DAYS,
} from '../courses.pricing-logic'
import type { CoursePricingInput, BillingPeriod } from '../schemas/courses.authoring.schema'
import type { CoursePricingDTO } from '../courses.types'

export async function getCoursePricingImpl(coursePublicId: string): Promise<CoursePricingDTO> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)

  const [discountRows, optionRows] = await Promise.all([
    db
      .select()
      .from(courseDiscounts)
      .where(and(eq(courseDiscounts.courseId, course.id), eq(courseDiscounts.isActive, true))),
    db
      .select({
        publicId: purchaseOptions.publicId,
        gatewayId: purchaseOptions.paymentGatewayId,
        isActive: purchaseOptions.isActive,
        durationDays: purchaseOptions.durationDays,
      })
      .from(purchaseOptions)
      .where(and(eq(purchaseOptions.courseId, course.id), isNull(purchaseOptions.deletedAt))),
  ])

  const gatewayRows = await db
    .select()
    .from(paymentGateways)
    .where(isNull(paymentGateways.deletedAt))

  const activeOptions = optionRows.filter((option) => option.isActive)

  const model: 'free' | 'one_time' | 'subscription' =
    course.pricingModel ?? (course.isFree ? 'free' : 'one_time')
  const subscriptionOption = activeOptions.find(
    (option) => option.durationDays !== LIFETIME_ACCESS_DAYS,
  )
  const billingPeriod: BillingPeriod | null =
    model === 'subscription'
      ? ((['monthly', 'quarterly', 'annual'] as const).find(
          (period) =>
            accessDaysForModel('subscription', period) === subscriptionOption?.durationDays,
        ) ?? 'monthly')
      : null

  return {
    model,
    priceAmount: course.priceAmount,
    priceCurrency: course.priceCurrency,
    billingPeriod,
    enrollmentStartAt: course.enrollmentStartAt?.toISOString() ?? null,
    enrollmentEndAt: course.enrollmentEndAt?.toISOString() ?? null,
    earlyBird:
      discountRows
        .filter((row) => row.kind === 'early_bird')
        .map((row) => ({ percentage: row.percentage, endsAt: row.endsAt?.toISOString() ?? null }))
        .at(0) ?? null,
    bulk:
      discountRows
        .filter((row) => row.kind === 'bulk')
        .map((row) => ({
          percentage: row.percentage,
          minEnrollments: row.minEnrollments,
        }))
        .at(0) ?? null,
    gatewayOptions: gatewayRows.map((gateway) => {
      const option = activeOptions.find((row) => row.gatewayId === gateway.id)
      return {
        gatewayPublicId: gateway.publicId,
        displayName: gateway.displayName,
        providerName: gateway.providerName,
        isEnabled: gateway.isEnabled,
        configured: option != null,
        purchaseOptionPublicId: option?.publicId ?? null,
      }
    }),
  }
}

export async function saveCoursePricingImpl(
  input: CoursePricingInput & { coursePublicId: string },
): Promise<{ coursePublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  // Gateways must exist, be enabled, and actually be selected.
  const gatewayRows = await db
    .select()
    .from(paymentGateways)
    .where(
      and(
        inArray(
          paymentGateways.publicId,
          input.gatewayPublicIds.length
            ? input.gatewayPublicIds
            : ['00000000-0000-0000-0000-000000000000'],
        ),
        isNull(paymentGateways.deletedAt),
      ),
    )
  const enabledSelected = gatewayRows.filter((gateway) => gateway.isEnabled)
  if (enabledSelected.length !== input.gatewayPublicIds.length) {
    throw new Error('GATEWAY_UNAVAILABLE')
  }
  if (enabledSelected.length === 0) {
    throw new Error('GATEWAY_REQUIRED: select at least one payment gateway')
  }

  const priceAmount =
    input.model === 'free' ? null : input.priceAmount != null ? String(input.priceAmount) : null

  await db.transaction(async (tx) => {
    await tx
      .update(courses)
      .set({
        isFree: input.model === 'free',
        pricingModel: input.model,
        priceAmount,
        priceCurrency: input.priceCurrency,
        enrollmentStartAt: input.enrollmentStartAt ? new Date(input.enrollmentStartAt) : null,
        enrollmentEndAt: input.enrollmentEndAt ? new Date(input.enrollmentEndAt) : null,
      })
      .where(eq(courses.id, course.id))

    // Discounts: upsert the two known kinds, deactivate whatever is absent.
    const desired = [
      input.earlyBird
        ? {
            kind: 'early_bird' as const,
            percentage: String(input.earlyBird.percentage),
            endsAt: input.earlyBird.endsAt ? new Date(input.earlyBird.endsAt) : null,
            minEnrollments: null as number | null,
          }
        : null,
      input.bulk
        ? {
            kind: 'bulk' as const,
            percentage: String(input.bulk.percentage),
            endsAt: null as Date | null,
            minEnrollments: input.bulk.minEnrollments,
          }
        : null,
    ].filter((row): row is NonNullable<typeof row> => row != null)

    const existingDiscounts = await tx
      .select()
      .from(courseDiscounts)
      .where(eq(courseDiscounts.courseId, course.id))

    for (const row of desired) {
      const existing = existingDiscounts.find((candidate) => candidate.kind === row.kind)
      if (existing) {
        await tx
          .update(courseDiscounts)
          .set({ ...row, isActive: true })
          .where(eq(courseDiscounts.id, existing.id))
      } else {
        await tx.insert(courseDiscounts).values({ courseId: course.id, ...row })
      }
    }
    const desiredKinds = desired.map((row) => row.kind)
    for (const existing of existingDiscounts) {
      if (!desiredKinds.includes(existing.kind)) {
        await tx
          .update(courseDiscounts)
          .set({ isActive: false })
          .where(eq(courseDiscounts.id, existing.id))
      }
    }

    // Purchase options per selected gateway (finance checkout contract).
    const durationDays = accessDaysForModel(input.model, input.billingPeriod)
    const displayName = accessLabelForModel(input.model, input.billingPeriod)
    const productId = buildProductId(course.slug, input.model, input.billingPeriod ?? undefined)

    const allOptions = await tx
      .select()
      .from(purchaseOptions)
      .where(and(eq(purchaseOptions.courseId, course.id), isNull(purchaseOptions.deletedAt)))

    for (const gateway of gatewayRows) {
      const existing = allOptions.find((option) => option.paymentGatewayId === gateway.id)
      if (existing) {
        await tx
          .update(purchaseOptions)
          .set({
            isActive: true,
            priceAmount: priceAmount ?? '0',
            priceCurrency: input.priceCurrency,
            durationDays,
            displayName,
            productId,
          })
          .where(eq(purchaseOptions.id, existing.id))
      } else {
        await tx.insert(purchaseOptions).values({
          courseId: course.id,
          paymentGatewayId: gateway.id,
          platform: 'web',
          productId,
          displayName,
          durationDays,
          priceAmount: priceAmount ?? '0',
          priceCurrency: input.priceCurrency,
        })
      }
    }

    const selectedGatewayIds = new Set(gatewayRows.map((gateway) => gateway.id))
    for (const option of allOptions) {
      if (!selectedGatewayIds.has(option.paymentGatewayId) && option.isActive) {
        await tx
          .update(purchaseOptions)
          .set({ isActive: false })
          .where(eq(purchaseOptions.id, option.id))
      }
    }
  })

  return { coursePublicId: course.publicId }
}
