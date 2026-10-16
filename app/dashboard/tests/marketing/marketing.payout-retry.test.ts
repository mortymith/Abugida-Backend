import { describe, expect, test } from 'bun:test'
import {
  attemptCountLabel,
  canRetryAsIs,
  canRetryPayout,
  canRetryWithNewDetails,
  computeReconciliation,
  conversionRateLabel,
  MAX_PAYOUT_ATTEMPTS,
  microDepositRequired,
  microDepositStatusLabel,
  negativeBalanceLabel,
  retryAsIsLabel,
  retryWithNewDetailsLabel,
} from '#/features/marketing/marketing.payout-retry'
import type { PayoutState } from '#/features/marketing/marketing.payout-retry'

const failed: PayoutState = {
  status: 'failed',
  attemptCount: 1,
  method: 'bank_transfer',
  isFirstPayout: false,
}
const failed3: PayoutState = {
  status: 'failed',
  attemptCount: 3,
  method: 'bank_transfer',
  isFirstPayout: false,
}
const paid: PayoutState = {
  status: 'paid',
  attemptCount: 1,
  method: 'bank_transfer',
  isFirstPayout: false,
}

describe('canRetryPayout', () => {
  test('permitted when failed + under cap', () =>
    expect(canRetryPayout(failed).permitted).toBe(true))
  test('blocked when paid', () => expect(canRetryPayout(paid).permitted).toBe(false))
  test('blocked at max attempts', () => {
    const r = canRetryPayout(failed3)
    expect(r.permitted).toBe(false)
    expect(r.reason).toContain('3 attempts')
  })
})
describe('canRetryWithNewDetails', () => {
  test('true when failed (always available)', () =>
    expect(canRetryWithNewDetails(failed3)).toBe(true))
  test('false when paid', () => expect(canRetryWithNewDetails(paid)).toBe(false))
})
describe('canRetryAsIs', () => {
  test('true when failed + under cap', () => expect(canRetryAsIs(failed)).toBe(true))
  test('false at max attempts', () => expect(canRetryAsIs(failed3)).toBe(false))
})
describe('attemptCountLabel', () => {
  test('names attempt + max', () => expect(attemptCountLabel(2)).toBe('Attempt 2 of 3'))
})
describe('retryWithNewDetailsLabel', () => {
  test('returns label', () => expect(retryWithNewDetailsLabel()).toBe('Retry with new details'))
})
describe('retryAsIsLabel', () => {
  test('returns label', () => expect(retryAsIsLabel()).toBe('Retry as-is'))
})
describe('MAX_PAYOUT_ATTEMPTS', () => {
  test('is 3', () => expect(MAX_PAYOUT_ATTEMPTS).toBe(3))
})

describe('microDepositRequired', () => {
  test('true for Telebirr first payout', () =>
    expect(microDepositRequired('telebirr', true)).toBe(true))
  test('false for Telebirr subsequent', () =>
    expect(microDepositRequired('telebirr', false)).toBe(false))
  test('false for bank_transfer', () =>
    expect(microDepositRequired('bank_transfer', true)).toBe(false))
})
describe('microDepositStatusLabel', () => {
  test('pending', () => expect(microDepositStatusLabel('pending')).toBe('Pending verification'))
  test('verified', () => expect(microDepositStatusLabel('verified')).toBe('Verified'))
  test('failed', () => expect(microDepositStatusLabel('failed')).toBe('Verification failed'))
  test('not_required → empty', () => expect(microDepositStatusLabel('not_required')).toBe(''))
})

describe('computeReconciliation', () => {
  test('balanced when variance < 0.01', () => {
    const r = computeReconciliation({
      expectedAmount: 100,
      payableAmount: 100,
      deferredAmount: 0,
      negativeBalanceCarry: 0,
    })
    expect(r.isBalanced).toBe(true)
    expect(r.label).toBe('Balanced')
  })
  test('under variance', () => {
    const r = computeReconciliation({
      expectedAmount: 100,
      payableAmount: 95,
      deferredAmount: 0,
      negativeBalanceCarry: 0,
    })
    expect(r.isBalanced).toBe(false)
    expect(r.variance).toBe(5)
    expect(r.label).toContain('under')
  })
  test('over variance', () => {
    const r = computeReconciliation({
      expectedAmount: 100,
      payableAmount: 105,
      deferredAmount: 0,
      negativeBalanceCarry: 0,
    })
    expect(r.variance).toBe(-5)
    expect(r.label).toContain('over')
  })
})
describe('negativeBalanceLabel', () => {
  test('null when positive', () => expect(negativeBalanceLabel(50)).toBeNull())
  test('names negative + offsets', () => {
    const label = negativeBalanceLabel(-45, 'ETB')
    expect(label).toContain('-45.00')
    expect(label).toContain('offsets next payout')
  })
})
describe('conversionRateLabel', () => {
  test('names rate + date', () => {
    expect(conversionRateLabel(138.5, 'Sep 29')).toContain('138.50')
    expect(conversionRateLabel(138.5, 'Sep 29')).toContain('Sep 29')
  })
})
