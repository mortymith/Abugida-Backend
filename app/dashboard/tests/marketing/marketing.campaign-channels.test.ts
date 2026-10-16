import { describe, expect, test } from 'bun:test'
import {
  computeExclusions,
  canCancelMidSend,
  formatExclusionBreakdown,
  shouldBlockRetryFailed,
  shouldShowSendDelay,
} from '#/features/marketing/marketing.campaign-channels'

describe('computeExclusions', () => {
  test('sums all exclusion reasons', () => {
    const e = computeExclusions(1000, {
      unsubscribed: 12,
      noVerifiedChannel: 3,
      alreadyEnrolled: 5,
    })
    expect(e.excludedCount).toBe(20)
    expect(e.reasons.unsubscribed).toBe(12)
    expect(e.reasons.no_verified_channel).toBe(3)
    expect(e.reasons.already_enrolled).toBe(5)
  })
  test('zero exclusions', () => {
    const e = computeExclusions(100, { unsubscribed: 0, noVerifiedChannel: 0, alreadyEnrolled: 0 })
    expect(e.excludedCount).toBe(0)
  })
})
describe('formatExclusionBreakdown', () => {
  test('names each reason', () => {
    const label = formatExclusionBreakdown(
      computeExclusions(100, { unsubscribed: 12, noVerifiedChannel: 3, alreadyEnrolled: 5 }),
    )
    expect(label).toContain('20 excluded')
    expect(label).toContain('12 unsubscribed')
    expect(label).toContain('3 no verified channel')
    expect(label).toContain('5 already enrolled')
  })
  test('empty when zero', () => {
    expect(
      formatExclusionBreakdown(
        computeExclusions(100, { unsubscribed: 0, noVerifiedChannel: 0, alreadyEnrolled: 0 }),
      ),
    ).toBe('')
  })
})
describe('shouldShowSendDelay', () => {
  test('true above 100', () => expect(shouldShowSendDelay(101)).toBe(true))
  test('false at 100', () => expect(shouldShowSendDelay(100)).toBe(false))
})
describe('canCancelMidSend', () => {
  test('true when sending', () => expect(canCancelMidSend('sending')).toBe(true))
  test('false when sent', () => expect(canCancelMidSend('sent')).toBe(false))
})
describe('shouldBlockRetryFailed', () => {
  test('true when retry already exists', () => {
    expect(shouldBlockRetryFailed('c1', ['c1'])).toBe(true)
  })
  test('false when no existing retry', () => {
    expect(shouldBlockRetryFailed('c1', ['c2'])).toBe(false)
  })
  test('false when null parent', () => {
    expect(shouldBlockRetryFailed(null, ['c1'])).toBe(false)
  })
})
