import { describe, expect, test } from 'bun:test'
import {
  canClaimInvite,
  computeInviteExpiry,
  ENROLLMENT_INVITE_CODE_LENGTH,
  ENROLLMENT_INVITE_EXPIRY_DAYS,
  generateInviteCode,
  generateInviteToken,
  hashInviteSecretSync,
  inviteExpiryLabel,
  isInviteExpired,
  INVITE_SUCCESS_COPY,
  buildEnrollmentUrl,
} from '#/features/students/students.invites'

describe('constants', () => {
  test('expiry is 7 days', () => {
    expect(ENROLLMENT_INVITE_EXPIRY_DAYS).toBe(7)
  })
  test('code length is 8', () => {
    expect(ENROLLMENT_INVITE_CODE_LENGTH).toBe(8)
  })
})

describe('generateInviteToken', () => {
  test('produces a non-empty string', () => {
    const token = generateInviteToken()
    expect(token.length).toBeGreaterThan(20)
  })
  test('produces URL-safe characters only', () => {
    const token = generateInviteToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  test('produces unique tokens', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateInviteToken())
    }
    expect(tokens.size).toBe(100)
  })
})

describe('generateInviteCode', () => {
  test('is exactly 8 characters', () => {
    expect(generateInviteCode()).toHaveLength(8)
  })
  test('uses unambiguous alphabet only', () => {
    const code = generateInviteCode()
    // No 0, O, 1, I, l
    expect(code).not.toMatch(/[0O1Il]/)
  })
  test('produces unique codes', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode())
    }
    expect(codes.size).toBe(100)
  })
})

describe('hashInviteSecretSync', () => {
  test('produces a 64-char hex string', () => {
    const hash = hashInviteSecretSync('test-token')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
  test('is deterministic', () => {
    expect(hashInviteSecretSync('test-token')).toBe(hashInviteSecretSync('test-token'))
  })
  test('different inputs produce different hashes', () => {
    expect(hashInviteSecretSync('a')).not.toBe(hashInviteSecretSync('b'))
  })
})

describe('computeInviteExpiry', () => {
  test('7 days from now', () => {
    const now = Date.parse('2026-01-15T12:00:00Z')
    const expiry = computeInviteExpiry(now)
    expect(expiry.getTime() - now).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('isInviteExpired', () => {
  const now = Date.parse('2026-01-15T12:00:00Z')
  test('true when pending and past expiry', () => {
    expect(isInviteExpired('pending', now - 1000, now)).toBe(true)
  })
  test('false when pending and before expiry', () => {
    expect(isInviteExpired('pending', now + 1000, now)).toBe(false)
  })
  test('false when not pending (terminal status)', () => {
    expect(isInviteExpired('claimed', now - 99999, now)).toBe(false)
    expect(isInviteExpired('cancelled', now - 99999, now)).toBe(false)
  })
})

describe('canClaimInvite', () => {
  const now = Date.parse('2026-01-15T12:00:00Z')
  test('true when pending and not expired', () => {
    expect(canClaimInvite('pending', now + 1000, now)).toBe(true)
  })
  test('false when expired', () => {
    expect(canClaimInvite('pending', now - 1000, now)).toBe(false)
  })
  test('false when already claimed', () => {
    expect(canClaimInvite('claimed', now + 1000, now)).toBe(false)
  })
})

describe('inviteExpiryLabel', () => {
  const now = Date.parse('2026-01-15T12:00:00Z')
  test('7 days remaining', () => {
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000
    expect(inviteExpiryLabel(expiresAt, now)).toBe('Expires in 7 days')
  })
  test('1 day remaining', () => {
    const expiresAt = now + 1 * 24 * 60 * 60 * 1000
    expect(inviteExpiryLabel(expiresAt, now)).toBe('Expires in 1 day')
  })
  test('0 days → Expires today', () => {
    const expiresAt = now + 12 * 60 * 60 * 1000 // 12h remaining
    expect(inviteExpiryLabel(expiresAt, now)).toBe('Expires today')
  })
  test('past → Expired', () => {
    expect(inviteExpiryLabel(now - 1000, now)).toBe('Expired')
  })
})

describe('buildEnrollmentUrl', () => {
  test('builds /enroll/:token URL', () => {
    expect(buildEnrollmentUrl('abc123', 'https://app.example.com')).toBe(
      'https://app.example.com/enroll/abc123',
    )
  })
})

describe('INVITE_SUCCESS_COPY', () => {
  test('matches spec wording', () => {
    expect(INVITE_SUCCESS_COPY).toContain('Enrollment link copied')
    expect(INVITE_SUCCESS_COPY).toContain('Telegram')
  })
})
