/**
 * S-8.3 Coupon revocation logic (spec 10 Rev-3). Revocation ≠ Deactivation.
 * Deactivate = reversible (isActive = false). Revoke = permanent + required
 * reason + audit-logged.
 */

export interface CouponState {
  readonly isActive: boolean
  readonly revokedAt: number | null
  readonly revokeReason: string | null
  readonly redemptionCount: number
}

export function canRevokeCoupon(coupon: CouponState): boolean {
  return coupon.isActive && coupon.revokedAt === null
}

export function canDeactivateCoupon(coupon: CouponState): boolean {
  return coupon.isActive && coupon.revokedAt === null
}

export function canReactivateCoupon(coupon: CouponState): boolean {
  return !coupon.isActive && coupon.revokedAt === null
}

export function revokeConfirmationMessage(code: string, redemptionCount: number): string {
  const noun = redemptionCount === 1 ? 'student has' : 'students have'
  return `Revoke ${code}? ${redemptionCount} ${noun} already used this code. The code will stop working immediately. This action is permanent and written to the audit log.`
}

export function deactivateConfirmationMessage(code: string): string {
  return `Deactivate ${code}? The code can be reactivated later.`
}

export function reactivateConfirmationMessage(code: string): string {
  return `Reactivate ${code}? The code will work immediately.`
}

export const REVOCATION_REASON_REQUIRED_LABEL = 'Choose a reason — it is written to the audit log'

export function requiresRevocationReason(): boolean {
  return true
}

export function isRevoked(coupon: CouponState): boolean {
  return coupon.revokedAt !== null
}

export function isDeactivated(coupon: CouponState): boolean {
  return !coupon.isActive && coupon.revokedAt === null
}

export function couponStatusPill(
  coupon: CouponState,
): 'active' | 'deactivated' | 'revoked' | 'expired' {
  if (coupon.revokedAt !== null) return 'revoked'
  if (!coupon.isActive) return 'deactivated'
  return 'active'
}
