import { describe, expect, test } from 'bun:test'
import {
  MARKETING_INSTRUMENTATION_EVENTS,
  trackMarketingEvent,
  validateMarketingPayload,
} from '#/features/marketing/marketing.instrumentation'

describe('MARKETING_INSTRUMENTATION_EVENTS', () => {
  test('includes events for all 5 screens', () => {
    expect(MARKETING_INSTRUMENTATION_EVENTS).toContain('campaign_sent')
    expect(MARKETING_INSTRUMENTATION_EVENTS).toContain('template_published')
    expect(MARKETING_INSTRUMENTATION_EVENTS).toContain('coupon_revoked')
    expect(MARKETING_INSTRUMENTATION_EVENTS).toContain('payout_completed')
    expect(MARKETING_INSTRUMENTATION_EVENTS).toContain('testimonial_published')
  })
})
describe('validateMarketingPayload', () => {
  test('valid payload', () => expect(validateMarketingPayload({ id: 'c1', count: 5 })).toBeNull())
  test('rejects empty id', () =>
    expect(validateMarketingPayload({ id: '' })).toContain('non-empty'))
  test('rejects email (PII)', () =>
    expect(validateMarketingPayload({ id: 'c1', email: 'a@b.com' } as any)).toContain('email'))
  test('rejects quote (content)', () =>
    expect(validateMarketingPayload({ id: 'c1', quote: 'Great course' } as any)).toContain('quote'))
  test('rejects amount (sensitive)', () =>
    expect(validateMarketingPayload({ id: 'c1', amount: 5900 } as any)).toContain('amount'))
  test('rejects non-number count', () =>
    expect(validateMarketingPayload({ id: 'c1', count: 'five' } as any)).toContain('number'))
})
describe('trackMarketingEvent', () => {
  test('calls send when valid', () => {
    const sent: string[] = []
    trackMarketingEvent('campaign_sent', { id: 'c1' }, (e) => sent.push(e))
    expect(sent).toHaveLength(1)
  })
  test('does not call send when invalid', () => {
    const sent: string[] = []
    trackMarketingEvent('campaign_sent', { id: '' }, (e) => sent.push(e))
    expect(sent).toHaveLength(0)
  })
})
