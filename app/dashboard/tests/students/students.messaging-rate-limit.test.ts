import { describe, expect, test } from 'bun:test'
import {
  checkAllRateLimits,
  checkBroadcastRateLimit,
  checkStudentRateLimit,
  MAX_BROADCASTS_PER_AUDIENCE_PER_DAY,
  MAX_MESSAGES_PER_STUDENT_PER_DAY,
  rateLimitLabel,
  shouldDisableSend,
} from '#/features/students/students.messaging-rate-limit'

const NOW = Date.parse('2026-01-15T12:00:00Z')

describe('constants', () => {
  test('3 broadcasts per audience per day', () => {
    expect(MAX_BROADCASTS_PER_AUDIENCE_PER_DAY).toBe(3)
  })
  test('20 messages per student per day', () => {
    expect(MAX_MESSAGES_PER_STUDENT_PER_DAY).toBe(20)
  })
})

describe('checkBroadcastRateLimit', () => {
  test('allowed when under limit', () => {
    const result = checkBroadcastRateLimit(
      { audienceBroadcastsToday: 2, studentMessagesToday: 0 },
      NOW,
    )
    expect(result.allowed).toBe(true)
  })
  test('blocked at limit (3)', () => {
    const result = checkBroadcastRateLimit(
      { audienceBroadcastsToday: 3, studentMessagesToday: 0 },
      NOW,
    )
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain('3 broadcasts')
      expect(result.reason).toContain('tomorrow')
    }
  })
  test('resetAt is next midnight', () => {
    const result = checkBroadcastRateLimit(
      { audienceBroadcastsToday: 3, studentMessagesToday: 0 },
      NOW,
    )
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.resetAt).toBeGreaterThan(NOW)
    }
  })
})

describe('checkStudentRateLimit', () => {
  test('allowed when under limit', () => {
    const result = checkStudentRateLimit(
      { audienceBroadcastsToday: 0, studentMessagesToday: 19 },
      NOW,
    )
    expect(result.allowed).toBe(true)
  })
  test('blocked at limit (20)', () => {
    const result = checkStudentRateLimit(
      { audienceBroadcastsToday: 0, studentMessagesToday: 20 },
      NOW,
    )
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain('20 messages')
    }
  })
})

describe('checkAllRateLimits', () => {
  test('allowed when both under limit', () => {
    const result = checkAllRateLimits({ audienceBroadcastsToday: 1, studentMessagesToday: 5 }, NOW)
    expect(result.allowed).toBe(true)
  })
  test('broadcast limit checked first', () => {
    const result = checkAllRateLimits({ audienceBroadcastsToday: 3, studentMessagesToday: 5 }, NOW)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain('broadcasts')
    }
  })
  test('student limit checked second', () => {
    const result = checkAllRateLimits({ audienceBroadcastsToday: 1, studentMessagesToday: 20 }, NOW)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain('20 messages')
    }
  })
})

describe('shouldDisableSend', () => {
  test('not disabled when under limit', () => {
    const result = shouldDisableSend({ audienceBroadcastsToday: 1, studentMessagesToday: 5 }, NOW)
    expect(result.disabled).toBe(false)
  })
  test('disabled with reason when at limit', () => {
    const result = shouldDisableSend({ audienceBroadcastsToday: 3, studentMessagesToday: 5 }, NOW)
    expect(result.disabled).toBe(true)
    expect(result.reason).toBeTruthy()
  })
  test('resetAt set when at limit', () => {
    const result = shouldDisableSend({ audienceBroadcastsToday: 3, studentMessagesToday: 5 }, NOW)
    expect(result.disabled).toBe(true)
    expect(result.resetAt).not.toBeNull()
  })
})

describe('rateLimitLabel', () => {
  test('empty when allowed', () => {
    expect(rateLimitLabel({ audienceBroadcastsToday: 1, studentMessagesToday: 5 }, NOW)).toBe('')
  })
  test('reason text when blocked', () => {
    const label = rateLimitLabel({ audienceBroadcastsToday: 3, studentMessagesToday: 5 }, NOW)
    expect(label).toContain('3 broadcasts')
  })
})
