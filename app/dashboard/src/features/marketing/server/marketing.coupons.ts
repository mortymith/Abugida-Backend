import { createServerFn } from '@tanstack/react-start'
import {
  couponBatchSchema,
  couponCreateSchema,
  couponPublicIdSchema,
  couponUpdateSchema,
} from '../schemas/marketing.schema'

/** Client-safe S-8.3 Discount & Coupon Codes server functions. */

export const listCoupons = createServerFn({ method: 'GET' })
  .validator((input: unknown) => (typeof input === 'string' ? { status: input } : (input ?? {})))
  .handler(async ({ data }) => {
    const { listCouponsImpl } = await import('./marketing.coupons.impl.server')
    return listCouponsImpl(data)
  })

export const createCoupon = createServerFn({ method: 'POST' })
  .validator((input: unknown) => couponCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { createCouponImpl } = await import('./marketing.coupons.impl.server')
    return createCouponImpl(data)
  })

export const generateCouponBatch = createServerFn({ method: 'POST' })
  .validator((input: unknown) => couponBatchSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateCouponBatchImpl } = await import('./marketing.coupons.impl.server')
    return generateCouponBatchImpl(data)
  })

export const updateCoupon = createServerFn({ method: 'POST' })
  .validator((input: unknown) => couponUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateCouponImpl } = await import('./marketing.coupons.impl.server')
    return updateCouponImpl(data)
  })

export const getCouponRedemptions = createServerFn({ method: 'GET' })
  .validator((input: unknown) => couponPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getCouponRedemptionsImpl } = await import('./marketing.coupons.impl.server')
    return getCouponRedemptionsImpl(data)
  })

export const countRecentRedemptions = createServerFn({ method: 'GET' })
  .validator((input: unknown) => couponPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { countRecentRedemptionsImpl } = await import('./marketing.coupons.impl.server')
    return countRecentRedemptionsImpl(data)
  })
