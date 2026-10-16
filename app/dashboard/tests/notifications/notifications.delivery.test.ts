import { describe, expect, test } from 'bun:test'
import {
  CHANNEL_LABELS,
  computeChannelBreakdown,
  formatChannelBreakdown,
  hasNoReachableChannel,
  isRetryableFailure,
  NOTIFICATION_CHANNELS,
  planChannelDelivery,
  summarizeDispatch,
} from '#/features/notifications/notifications.delivery'
import type {
  DeliveryState,
  NotificationChannel,
  NotificationIntent,
  UserChannelProfile,
} from '#/features/notifications/notifications.delivery'

const FULL_PROFILE: UserChannelProfile = {
  hasTelegram: true,
  telegramEnabled: true,
  email: 'student@example.com',
  emailVerified: true,
}

const NO_TELEGRAM_PROFILE: UserChannelProfile = {
  hasTelegram: false,
  telegramEnabled: true,
  email: null,
  emailVerified: null,
}

const UNVERIFIED_EMAIL_PROFILE: UserChannelProfile = {
  hasTelegram: true,
  telegramEnabled: true,
  email: 'student@example.com',
  emailVerified: false,
}

describe('channel vocabulary', () => {
  test('three channels: in_app, telegram, email', () => {
    expect(NOTIFICATION_CHANNELS).toEqual(['in_app', 'telegram', 'email'])
    expect(CHANNEL_LABELS).toEqual({
      in_app: 'In-app',
      telegram: 'Telegram',
      email: 'Email',
    })
  })
})

describe('planChannelDelivery', () => {
  test('in-app is always available', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['in_app'],
      recipient: NO_TELEGRAM_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(plans[0].availability.kind).toBe('available')
  })

  test('telegram disabled when no linked account', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['telegram'],
      recipient: NO_TELEGRAM_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(plans[0].availability.kind).toBe('disabled')
    if (plans[0].availability.kind === 'disabled') {
      expect(plans[0].availability.reason).toContain('No Telegram account linked')
    }
  })

  test('telegram unavailable when workspace disabled', () => {
    const profile: UserChannelProfile = {
      hasTelegram: true,
      telegramEnabled: false,
      email: null,
      emailVerified: null,
    }
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['telegram'],
      recipient: profile,
    }
    const plans = planChannelDelivery(intent)
    expect(plans[0].availability.kind).toBe('unavailable')
  })

  test('email unavailable when no address on file', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['email'],
      recipient: NO_TELEGRAM_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(plans[0].availability.kind).toBe('unavailable')
  })

  test('email disabled when address not verified', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['email'],
      recipient: UNVERIFIED_EMAIL_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(plans[0].availability.kind).toBe('disabled')
    if (plans[0].availability.kind === 'disabled') {
      expect(plans[0].availability.reason).toContain('not verified')
    }
  })

  test('all channels available for full profile', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['in_app', 'telegram', 'email'],
      recipient: FULL_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(plans.every((p) => p.availability.kind === 'available')).toBe(true)
  })
})

describe('isRetryableFailure', () => {
  test('failed delivery on available channel is retryable', () => {
    const plan = { channel: 'telegram' as const, availability: { kind: 'available' as const } }
    const state: DeliveryState = {
      kind: 'failed',
      error: 'provider timeout',
      retryable: true,
    }
    expect(isRetryableFailure('telegram', plan, state)).toBe(true)
  })

  test('failed delivery on disabled channel is not retryable', () => {
    const plan = {
      channel: 'telegram' as const,
      availability: { kind: 'disabled' as const, reason: 'no account' },
    }
    const state: DeliveryState = {
      kind: 'failed',
      error: 'provider timeout',
      retryable: true,
    }
    expect(isRetryableFailure('telegram', plan, state)).toBe(false)
  })

  test('delivered state is not a failure', () => {
    const plan = { channel: 'in_app' as const, availability: { kind: 'available' as const } }
    const state: DeliveryState = { kind: 'delivered', at: Date.now() }
    expect(isRetryableFailure('in_app', plan, state)).toBe(false)
  })
})

describe('summarizeDispatch', () => {
  test('per-channel reporting (never one toast for a batch)', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['in_app', 'telegram', 'email'],
      recipient: FULL_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    const states = new Map<NotificationChannel, DeliveryState>([
      ['in_app', { kind: 'delivered', at: Date.now() }],
      ['telegram', { kind: 'failed', error: 'timeout', retryable: true }],
      ['email', { kind: 'pending' }],
    ])
    const summary = summarizeDispatch(plans, states)
    expect(summary.delivered).toEqual(['in_app'])
    expect(summary.failed).toHaveLength(1)
    expect(summary.failed[0].channel).toBe('telegram')
    expect(summary.pending).toEqual(['email'])
  })

  test('suppressed channels are reported separately', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['in_app', 'email'],
      recipient: NO_TELEGRAM_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    const states = new Map<NotificationChannel, DeliveryState>([
      ['in_app', { kind: 'delivered', at: Date.now() }],
      ['email', { kind: 'suppressed', reason: 'no address' }],
    ])
    const summary = summarizeDispatch(plans, states)
    expect(summary.delivered).toEqual(['in_app'])
    expect(summary.suppressed).toHaveLength(1)
    expect(summary.suppressed[0].channel).toBe('email')
  })
})

describe('hasNoReachableChannel', () => {
  test('true when every channel is unreachable', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['telegram', 'email'],
      recipient: NO_TELEGRAM_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(hasNoReachableChannel(plans)).toBe(true)
  })

  test('false when in-app is available', () => {
    const intent: NotificationIntent = {
      template: 'course.published',
      channels: ['in_app'],
      recipient: NO_TELEGRAM_PROFILE,
    }
    const plans = planChannelDelivery(intent)
    expect(hasNoReachableChannel(plans)).toBe(false)
  })
})

describe('computeChannelBreakdown', () => {
  test('counts recipients reachable per channel', () => {
    const noEmail: UserChannelProfile = {
      hasTelegram: true,
      telegramEnabled: true,
      email: null,
      emailVerified: null,
    }
    const breakdown = computeChannelBreakdown([FULL_PROFILE, noEmail, NO_TELEGRAM_PROFILE])
    expect(breakdown.total).toBe(3)
    expect(breakdown.inApp).toBe(3)
    expect(breakdown.telegram).toBe(2)
    expect(breakdown.email).toBe(1)
    expect(breakdown.noEmail).toBe(2)
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
