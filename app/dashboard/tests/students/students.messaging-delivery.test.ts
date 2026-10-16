import { describe, expect, test } from 'bun:test'
import {
  deliveryFailureSummary,
  deliveryStateLabel,
  DORMANCY_THRESHOLD_MS,
  isDormantForRelay,
  mergeReadReceipts,
  planDelivery,
} from '#/features/students/students.messaging-delivery'
import type {
  DeliveryRow,
  RecipientChannelProfile,
} from '#/features/students/students.messaging-delivery'

const ACTIVE_PROFILE: RecipientChannelProfile = {
  hasInApp: true,
  hasTelegram: true,
  telegramVerified: true,
  hasEmail: true,
  emailVerified: true,
  lastAppOpenAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago — not dormant
}

const DORMANT_PROFILE: RecipientChannelProfile = {
  hasInApp: true,
  hasTelegram: true,
  telegramVerified: true,
  hasEmail: true,
  emailVerified: true,
  lastAppOpenAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago — dormant
}

const NEVER_OPENED_PROFILE: RecipientChannelProfile = {
  hasInApp: true,
  hasTelegram: true,
  telegramVerified: true,
  hasEmail: false,
  emailVerified: false,
  lastAppOpenAt: null, // never opened — dormant
}

describe('DORMANCY_THRESHOLD_MS', () => {
  test('is 7 days', () => {
    expect(DORMANCY_THRESHOLD_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('isDormantForRelay', () => {
  test('false when opened recently', () => {
    expect(isDormantForRelay(ACTIVE_PROFILE, Date.now())).toBe(false)
  })
  test('true when dormant 14+ days', () => {
    expect(isDormantForRelay(DORMANT_PROFILE, Date.now())).toBe(true)
  })
  test('true when never opened', () => {
    expect(isDormantForRelay(NEVER_OPENED_PROFILE, Date.now())).toBe(true)
  })
})

describe('planDelivery', () => {
  test('in-app only for active student', () => {
    const plan = planDelivery(ACTIVE_PROFILE, Date.now())
    expect(plan.channels).toEqual(['in_app'])
    expect(plan.willRelayToTelegram).toBe(false)
    expect(plan.willRelayToEmail).toBe(false)
    expect(plan.noReachableChannel).toBe(false)
  })

  test('in-app + telegram + email for dormant student with verified channels', () => {
    const plan = planDelivery(DORMANT_PROFILE, Date.now())
    expect(plan.channels).toEqual(['in_app', 'telegram', 'email'])
    expect(plan.willRelayToTelegram).toBe(true)
    expect(plan.willRelayToEmail).toBe(true)
  })

  test('in-app + telegram only when no email', () => {
    const plan = planDelivery(NEVER_OPENED_PROFILE, Date.now())
    expect(plan.channels).toEqual(['in_app', 'telegram'])
    expect(plan.willRelayToEmail).toBe(false)
  })

  test('no relay to unverified telegram', () => {
    const unverifiedTg: RecipientChannelProfile = {
      ...DORMANT_PROFILE,
      telegramVerified: false,
    }
    const plan = planDelivery(unverifiedTg, Date.now())
    expect(plan.willRelayToTelegram).toBe(false)
    expect(plan.channels).not.toContain('telegram')
  })
})

describe('mergeReadReceipts', () => {
  test('not read when all pending', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'pending',
        deliveredAt: null,
        readAt: null,
        failureReason: null,
      },
    ]
    const result = mergeReadReceipts(deliveries)
    expect(result.isRead).toBe(false)
  })

  test('read when any delivery is read', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'read',
        deliveredAt: 1000,
        readAt: 2000,
        failureReason: null,
      },
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'telegram',
        state: 'delivered',
        deliveredAt: 1500,
        readAt: null,
        failureReason: null,
      },
    ]
    const result = mergeReadReceipts(deliveries)
    expect(result.isRead).toBe(true)
    expect(result.readAt).toBe(2000)
    expect(result.readChannel).toBe('in_app')
  })

  test('read picks earliest read timestamp', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'read',
        deliveredAt: 1000,
        readAt: 3000,
        failureReason: null,
      },
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'telegram',
        state: 'read',
        deliveredAt: 1500,
        readAt: 2000,
        failureReason: null,
      },
    ]
    const result = mergeReadReceipts(deliveries)
    expect(result.readAt).toBe(2000)
    expect(result.readChannel).toBe('telegram')
  })
})

describe('deliveryStateLabel', () => {
  test('Read when any delivery is read', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'read',
        deliveredAt: 1000,
        readAt: 2000,
        failureReason: null,
      },
    ]
    expect(deliveryStateLabel(deliveries)).toBe('Read')
  })

  test('Delivered ✓ when any delivered', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'delivered',
        deliveredAt: 1000,
        readAt: null,
        failureReason: null,
      },
    ]
    expect(deliveryStateLabel(deliveries)).toBe('Delivered ✓')
  })

  test('Not delivered when all failed', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'failed',
        deliveredAt: null,
        readAt: null,
        failureReason: 'x',
      },
    ]
    expect(deliveryStateLabel(deliveries)).toBe('Not delivered')
  })

  test('Sending… when pending', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'pending',
        deliveredAt: null,
        readAt: null,
        failureReason: null,
      },
    ]
    expect(deliveryStateLabel(deliveries)).toBe('Sending…')
  })
})

describe('deliveryFailureSummary', () => {
  test('null when no failures', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'in_app',
        state: 'delivered',
        deliveredAt: 1000,
        readAt: null,
        failureReason: null,
      },
    ]
    expect(deliveryFailureSummary(deliveries, ACTIVE_PROFILE)).toBeNull()
  })

  test('names the failure reason', () => {
    const deliveries: DeliveryRow[] = [
      {
        messageId: 'm1',
        recipientId: 's1',
        channel: 'email',
        state: 'failed',
        deliveredAt: null,
        readAt: null,
        failureReason: 'no_email',
      },
    ]
    const noEmailProfile: RecipientChannelProfile = {
      ...ACTIVE_PROFILE,
      hasEmail: false,
      emailVerified: false,
    }
    expect(deliveryFailureSummary(deliveries, noEmailProfile)).toContain('no email on file')
  })
})
