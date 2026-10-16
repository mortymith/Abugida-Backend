import { describe, expect, test } from 'bun:test'
import {
  computeChannelBreakdown,
  formatChannelBreakdown,
  hasNoReachableChannel,
  planChannelDelivery,
} from '#/features/notifications/notifications.delivery'
import type { UserProfile } from '#/features/notifications/notifications.delivery'

const FULL: UserProfile = {
  hasTelegram: true,
  telegramVerified: true,
  email: 'a@b.com',
  emailVerified: true,
}
const NO_EMAIL: UserProfile = {
  hasTelegram: true,
  telegramVerified: true,
  email: null,
  emailVerified: false,
}
const NO_CONTACT: UserProfile = {
  hasTelegram: false,
  telegramVerified: false,
  email: null,
  emailVerified: false,
}

describe('planChannelDelivery', () => {
  test('in-app always available', () => {
    const plans = planChannelDelivery(['in_app'], NO_CONTACT)
    expect(plans[0].availability.kind).toBe('available')
  })
  test('telegram unavailable when no handle', () => {
    const plans = planChannelDelivery(['telegram'], NO_CONTACT)
    expect(plans[0].availability.kind).toBe('unavailable')
  })
  test('email disabled when not verified', () => {
    const plans = planChannelDelivery(['email'], { ...FULL, emailVerified: false })
    expect(plans[0].availability.kind).toBe('disabled')
  })
  test('all available for full profile', () => {
    const plans = planChannelDelivery(['in_app', 'telegram', 'email'], FULL)
    expect(plans.every((p) => p.availability.kind === 'available')).toBe(true)
  })
})
describe('hasNoReachableChannel', () => {
  test('true when all unavailable', () => {
    const plans = planChannelDelivery(['telegram', 'email'], NO_CONTACT)
    expect(hasNoReachableChannel(plans)).toBe(true)
  })
  test('false when in-app available', () => {
    expect(hasNoReachableChannel(planChannelDelivery(['in_app'], NO_CONTACT))).toBe(false)
  })
})
describe('computeChannelBreakdown', () => {
  test('counts per channel', () => {
    const b = computeChannelBreakdown([FULL, NO_EMAIL, NO_CONTACT])
    expect(b.total).toBe(3)
    expect(b.inApp).toBe(3)
    expect(b.telegram).toBe(2)
    expect(b.email).toBe(1)
    expect(b.noEmail).toBe(2)
  })
})
describe('formatChannelBreakdown', () => {
  test('includes all counts', () => {
    const label = formatChannelBreakdown({
      inApp: 1204,
      telegram: 1180,
      email: 610,
      noEmail: 594,
      total: 1204,
    })
    expect(label).toContain('recipients')
    expect(label).toContain('in-app')
    expect(label).toContain('Telegram')
    expect(label).toContain('email')
    expect(label).toContain('no email')
  })
})
