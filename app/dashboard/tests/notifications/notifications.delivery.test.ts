import { describe, expect, test } from 'bun:test'
import {
  hasNoReachableChannel,
  isRetryableFailure,
  planChannelDelivery,
  summarizeDispatch,
} from '#/features/notifications/notifications.delivery'
import type {
  DeliveryState,
  NotificationIntent,
  UserProfile,
} from '#/features/notifications/notifications.delivery'

const FULL: UserProfile = {
  hasTelegram: true,
  telegramVerified: true,
  email: 'a@b.com',
  emailVerified: true,
}
const NO_CONTACT: UserProfile = {
  hasTelegram: false,
  telegramVerified: false,
  email: null,
  emailVerified: false,
}

describe('planChannelDelivery', () => {
  test('in-app always available', () => {
    const plans = planChannelDelivery({ type: 'test', channels: ['in_app'], recipient: NO_CONTACT })
    expect(plans[0].availability.kind).toBe('available')
  })
  test('telegram unavailable when no handle', () => {
    const plans = planChannelDelivery({
      type: 'test',
      channels: ['telegram'],
      recipient: NO_CONTACT,
    })
    expect(plans[0].availability.kind).toBe('unavailable')
  })
  test('email disabled when not verified', () => {
    const plans = planChannelDelivery({
      type: 'test',
      channels: ['email'],
      recipient: { ...FULL, emailVerified: false },
    })
    expect(plans[0].availability.kind).toBe('disabled')
  })
  test('all available for full profile', () => {
    const plans = planChannelDelivery({
      type: 'test',
      channels: ['in_app', 'telegram', 'email'],
      recipient: FULL,
    })
    expect(plans.every((p) => p.availability.kind === 'available')).toBe(true)
  })
})

describe('hasNoReachableChannel', () => {
  test('true when all unavailable', () => {
    const plans = planChannelDelivery({
      type: 'test',
      channels: ['telegram', 'email'],
      recipient: NO_CONTACT,
    })
    expect(hasNoReachableChannel(plans)).toBe(true)
  })
  test('false when in-app available', () => {
    const plans = planChannelDelivery({ type: 'test', channels: ['in_app'], recipient: NO_CONTACT })
    expect(hasNoReachableChannel(plans)).toBe(false)
  })
})

describe('summarizeDispatch', () => {
  test('counts delivered/failed/pending', () => {
    const intent: NotificationIntent = {
      type: 'test',
      channels: ['in_app', 'telegram', 'email'],
      recipient: FULL,
    }
    const plans = planChannelDelivery(intent)
    const states = new Map<string, DeliveryState>([
      ['in_app', { kind: 'delivered', at: 1000 }],
      ['telegram', { kind: 'failed', error: 'timeout', retryable: true }],
      ['email', { kind: 'pending' }],
    ])
    const summary = summarizeDispatch(plans, states as ReadonlyMap<any, any>)
    expect(summary.delivered).toEqual(['in_app'])
    expect(summary.failed).toHaveLength(1)
    expect(summary.pending).toEqual(['email'])
  })
})

describe('isRetryableFailure', () => {
  test('true for retryable failed', () => {
    expect(isRetryableFailure('telegram', { kind: 'failed', error: 'x', retryable: true })).toBe(
      true,
    )
  })
  test('false for non-retryable', () => {
    expect(isRetryableFailure('telegram', { kind: 'failed', error: 'x', retryable: false })).toBe(
      false,
    )
  })
  test('false for delivered', () => {
    expect(isRetryableFailure('telegram', { kind: 'delivered', at: 0 })).toBe(false)
  })
})
