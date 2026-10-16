import { describe, expect, test } from 'bun:test'
import {
  canDeactivateCoupon,
  canReactivateCoupon,
  canRevokeCoupon,
  couponStatusPill,
  deactivateConfirmationMessage,
  isDeactivated,
  isRevoked,
  REVOCATION_REASON_REQUIRED_LABEL,
  requiresRevocationReason,
  revokeConfirmationMessage,
} from '#/features/marketing/marketing.coupon-revocation'
import type { CouponState } from '#/features/marketing/marketing.coupon-revocation'

const active: CouponState = {
  isActive: true,
  revokedAt: null,
  revokeReason: null,
  redemptionCount: 10,
}
const deactivated: CouponState = {
  isActive: false,
  revokedAt: null,
  revokeReason: null,
  redemptionCount: 5,
}
const revoked: CouponState = {
  isActive: false,
  revokedAt: 1000,
  revokeReason: 'fraud',
  redemptionCount: 3,
}

describe('canRevokeCoupon', () => {
  test('true when active + not revoked', () => expect(canRevokeCoupon(active)).toBe(true))
  test('false when deactivated', () => expect(canRevokeCoupon(deactivated)).toBe(false))
  test('false when already revoked', () => expect(canRevokeCoupon(revoked)).toBe(false))
})
describe('canDeactivateCoupon', () => {
  test('true when active', () => expect(canDeactivateCoupon(active)).toBe(true))
  test('false when already deactivated', () => expect(canDeactivateCoupon(deactivated)).toBe(false))
})
describe('canReactivateCoupon', () => {
  test('true when deactivated + not revoked', () =>
    expect(canReactivateCoupon(deactivated)).toBe(true))
  test('false when revoked', () => expect(canReactivateCoupon(revoked)).toBe(false))
})
describe('revokeConfirmationMessage', () => {
  test('names code + redemption count + permanent', () => {
    const msg = revokeConfirmationMessage('SAVE20', 42)
    expect(msg).toContain('SAVE20')
    expect(msg).toContain('42 students have')
    expect(msg).toContain('permanent')
    expect(msg).toContain('audit log')
  })
  test('singular for 1', () => {
    expect(revokeConfirmationMessage('SAVE20', 1)).toContain('1 student has')
  })
})
describe('deactivateConfirmationMessage', () => {
  test('names code + reactivatable', () => {
    expect(deactivateConfirmationMessage('SAVE20')).toContain('reactivated')
  })
})
describe('isRevoked / isDeactivated', () => {
  test('isRevoked true for revoked', () => expect(isRevoked(revoked)).toBe(true))
  test('isRevoked false for active', () => expect(isRevoked(active)).toBe(false))
  test('isDeactivated true for deactivated', () => expect(isDeactivated(deactivated)).toBe(true))
  test('isDeactivated false for revoked', () => expect(isDeactivated(revoked)).toBe(false))
})
describe('couponStatusPill', () => {
  test('active', () => expect(couponStatusPill(active)).toBe('active'))
  test('deactivated', () => expect(couponStatusPill(deactivated)).toBe('deactivated'))
  test('revoked', () => expect(couponStatusPill(revoked)).toBe('revoked'))
})
describe('requiresRevocationReason', () => {
  test('always true', () => expect(requiresRevocationReason()).toBe(true))
})
describe('REVOCATION_REASON_REQUIRED_LABEL', () => {
  test('mentions audit log', () => expect(REVOCATION_REASON_REQUIRED_LABEL).toContain('audit log'))
})
