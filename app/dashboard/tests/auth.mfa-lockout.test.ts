import { describe, expect, test } from 'bun:test'
import {
  MFA_LOCKOUT_SECONDS,
  MFA_MAX_ATTEMPTS,
  challengeNotice,
  isLocked,
  lockSecondsRemaining,
  normaliseBackupCode,
  normaliseTotpCode,
  onlyAdminRecoveryMessage,
  recoveryFor,
  remainingAttempts,
} from '#/features/auth/auth.mfa-lockout'
import type { MfaChallengeStatus } from '#/features/auth/auth.mfa-lockout'

/**
 * S-0.3 MFA challenge.
 *
 * The two properties these tests defend, both of which the previous
 * implementation got wrong:
 *
 *  1. **The lockout is derived from server numbers.** A reload cannot clear it,
 *     because nothing about the lock lives in component state.
 *  2. **There is no dead end.** A locked-out user with zero other Admins must
 *     always see a working recovery path — the spec's acceptance criterion 1,
 *     and the specific defect Revision 3 was written to fix.
 */

const NOW = Date.parse('2026-09-30T12:00:00.000Z')
const IN_10_MIN = new Date(NOW + 10 * 60 * 1000).toISOString()

function status(overrides: Partial<MfaChallengeStatus> = {}): MfaChallengeStatus {
  return {
    attemptsUsed: 0,
    lockedUntil: null,
    otherAdminAvailable: false,
    otherAdminName: null,
    ...overrides,
  }
}

describe('lock state', () => {
  test('the spec budget is 5 attempts and a 15-minute cooldown', () => {
    expect(MFA_MAX_ATTEMPTS).toBe(5)
    expect(MFA_LOCKOUT_SECONDS).toBe(15 * 60)
  })

  test('reads the deadline from the server, not from local attempt counting', () => {
    const locked = status({ attemptsUsed: 5, lockedUntil: IN_10_MIN })
    expect(isLocked(locked, NOW)).toBe(true)
    expect(lockSecondsRemaining(locked, NOW)).toBe(600)
  })

  test('an elapsed lock lifts without a reload', () => {
    const expired = status({
      attemptsUsed: 5,
      lockedUntil: new Date(NOW - 1000).toISOString(),
    })
    expect(isLocked(expired, NOW)).toBe(false)
    expect(lockSecondsRemaining(expired, NOW)).toBe(0)
  })

  test('remaining attempts are never negative', () => {
    expect(remainingAttempts(status({ attemptsUsed: 2 }))).toBe(3)
    expect(remainingAttempts(status({ attemptsUsed: 9 }))).toBe(0)
  })

  test('a missing or malformed deadline is treated as unlocked', () => {
    expect(isLocked(status({ lockedUntil: 'not-a-date' }), NOW)).toBe(false)
  })
})

describe('recoveryFor — the no-dead-end rule', () => {
  test('offers an admin reset when a second verified Admin exists', () => {
    expect(recoveryFor(status({ otherAdminAvailable: true }))).toBe('admin_reset')
  })

  test('falls back to support recovery for the only Admin', () => {
    expect(recoveryFor(status({ otherAdminAvailable: false }))).toBe('support')
  })

  test('a locked notice always carries a recovery path', () => {
    // Spec acceptance criterion 1: no state renders a bare "contact your Admin".
    for (const otherAdminAvailable of [true, false]) {
      const notice = challengeNotice({
        status: status({ attemptsUsed: 5, lockedUntil: IN_10_MIN, otherAdminAvailable }),
        nowMs: NOW,
      })
      expect(notice.recovery).not.toBeNull()
      expect(notice.message).not.toMatch(/contact your (workspace )?admin/i)
    }
  })

  test('the only-Admin copy names the action rather than a person to ask', () => {
    const message = onlyAdminRecoveryMessage()
    expect(message).toContain('only Admin')
    expect(message).toContain('support request')
    expect(message).not.toMatch(/contact your/i)
  })
})

describe('challengeNotice', () => {
  test('says nothing on a fresh challenge', () => {
    expect(challengeNotice({ status: status(), nowMs: NOW }).message).toBe('')
  })

  test('a wrong code reports remaining attempts rather than hiding them', () => {
    const notice = challengeNotice({ status: status({ attemptsUsed: 1 }), nowMs: NOW })
    expect(notice.message).toContain("didn't work")
  })

  test('the last attempts get a distinct, louder tone', () => {
    const notice = challengeNotice({ status: status({ attemptsUsed: 4 }), nowMs: NOW })
    expect(notice.tone).toBe('warning')
    expect(notice.message).toContain('1 attempt left')
  })

  test('a 5xx is not counted as a failed attempt and says nothing was consumed', () => {
    const notice = challengeNotice({ status: status(), nowMs: NOW, serverError: true })
    expect(notice.message).toContain('nothing was consumed')
    expect(notice.recovery).toBeNull()
  })

  test('offline is a state, not a failure — nothing is queued', () => {
    const notice = challengeNotice({ status: status(), nowMs: NOW, online: false })
    expect(notice.message).toContain('offline')
    expect(notice.tone).toBe('warning')
  })

  test('a backup-code failure names the backup code, not "that code"', () => {
    const notice = challengeNotice({
      status: status({ attemptsUsed: 1 }),
      nowMs: NOW,
      mode: 'backup',
    })
    expect(notice.message).toContain('backup code')
  })

  test('the lockout notice names the recovery it is offering', () => {
    const withAdmin = challengeNotice({
      status: status({ attemptsUsed: 5, lockedUntil: IN_10_MIN, otherAdminAvailable: true }),
      nowMs: NOW,
    })
    expect(withAdmin.message).toContain('admin reset')

    const alone = challengeNotice({
      status: status({ attemptsUsed: 5, lockedUntil: IN_10_MIN, otherAdminAvailable: false }),
      nowMs: NOW,
    })
    expect(alone.message).toContain('support request')
  })
})

describe('code normalisation', () => {
  test('a TOTP code keeps only digits and stops at six', () => {
    expect(normaliseTotpCode(' 123 456 ')).toBe('123456')
    expect(normaliseTotpCode('1234567890')).toBe('123456')
    expect(normaliseTotpCode('12a3-45')).toBe('12345')
  })

  test('a backup code survives the spaces and caps people paste in', () => {
    expect(normaliseBackupCode(' X4K9 - 2MQW ')).toBe('x4k9-2mqw')
  })
})
