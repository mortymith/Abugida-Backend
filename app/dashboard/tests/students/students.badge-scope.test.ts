import { describe, expect, test } from 'bun:test'
import {
  badgeAppliesToCourse,
  badgeScopeLabel,
  BADGE_SCOPE_LABELS,
  canRevokeAward,
  isAwardVisible,
  manualAwardConflictMessage,
  revokeConfirmationMessage,
  revokeOutcomeMessage,
  shouldDisableEmailCheckbox,
  validateBadgeScope,
} from '#/features/students/students.badge-scope'
import type { BadgeAward, BadgeScope } from '#/features/students/students.badge-scope'

describe('BADGE_SCOPE_LABELS', () => {
  test('global and course', () => {
    expect(BADGE_SCOPE_LABELS).toEqual({ global: 'All courses', course: 'Per-course' })
  })
})

describe('badgeScopeLabel', () => {
  test('All courses for global', () => {
    const scope: BadgeScope = { kind: 'global', courseId: null, courseName: null }
    expect(badgeScopeLabel(scope)).toBe('All courses')
  })
  test('course name for per-course', () => {
    const scope: BadgeScope = { kind: 'course', courseId: 'c1', courseName: 'TOEFL Complete' }
    expect(badgeScopeLabel(scope)).toBe('TOEFL Complete')
  })
})

describe('badgeAppliesToCourse', () => {
  test('global applies to all courses', () => {
    const scope: BadgeScope = { kind: 'global', courseId: null, courseName: null }
    expect(badgeAppliesToCourse(scope, 'c1')).toBe(true)
    expect(badgeAppliesToCourse(scope, 'c2')).toBe(true)
  })
  test('per-course applies only to scoped course', () => {
    const scope: BadgeScope = { kind: 'course', courseId: 'c1', courseName: 'TOEFL' }
    expect(badgeAppliesToCourse(scope, 'c1')).toBe(true)
    expect(badgeAppliesToCourse(scope, 'c2')).toBe(false)
  })
})

describe('validateBadgeScope', () => {
  test('global with courseId is invalid', () => {
    const scope: BadgeScope = { kind: 'global', courseId: 'c1', courseName: 'TOEFL' }
    expect(validateBadgeScope(scope)).toContain('must not have a course scope')
  })
  test('course without courseId is invalid', () => {
    const scope: BadgeScope = { kind: 'course', courseId: null, courseName: null }
    expect(validateBadgeScope(scope)).toContain('must specify a course')
  })
  test('valid global', () => {
    const scope: BadgeScope = { kind: 'global', courseId: null, courseName: null }
    expect(validateBadgeScope(scope)).toBeNull()
  })
  test('valid course', () => {
    const scope: BadgeScope = { kind: 'course', courseId: 'c1', courseName: 'TOEFL' }
    expect(validateBadgeScope(scope)).toBeNull()
  })
})

describe('isAwardVisible', () => {
  test('true for active', () => {
    const award: BadgeAward = {
      id: 'a1',
      badgeId: 'b1',
      studentId: 's1',
      state: 'active',
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    }
    expect(isAwardVisible(award)).toBe(true)
  })
  test('false for revoked', () => {
    const award: BadgeAward = {
      id: 'a1',
      badgeId: 'b1',
      studentId: 's1',
      state: 'revoked',
      revokedAt: 1000,
      revokedBy: 'u1',
      revokeReason: 'error',
    }
    expect(isAwardVisible(award)).toBe(false)
  })
  test('false for archived', () => {
    const award: BadgeAward = {
      id: 'a1',
      badgeId: 'b1',
      studentId: 's1',
      state: 'archived',
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    }
    expect(isAwardVisible(award)).toBe(false)
  })
})

describe('canRevokeAward', () => {
  test('true for active', () => {
    const award: BadgeAward = {
      id: 'a1',
      badgeId: 'b1',
      studentId: 's1',
      state: 'active',
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    }
    expect(canRevokeAward(award)).toBe(true)
  })
  test('false for revoked', () => {
    const award: BadgeAward = {
      id: 'a1',
      badgeId: 'b1',
      studentId: 's1',
      state: 'revoked',
      revokedAt: 1000,
      revokedBy: 'u1',
      revokeReason: 'error',
    }
    expect(canRevokeAward(award)).toBe(false)
  })
})

describe('revokeConfirmationMessage', () => {
  test('singular student', () => {
    expect(revokeConfirmationMessage('First Steps', 1)).toContain('1 student')
  })
  test('plural students', () => {
    const msg = revokeConfirmationMessage('First Steps', 1842)
    expect(msg).toContain('1842 students')
  })
  test('contains badge name', () => {
    expect(revokeConfirmationMessage('First Steps', 10)).toContain('First Steps')
  })
  test('contains notify text', () => {
    expect(revokeConfirmationMessage('First Steps', 10)).toContain('notify')
  })
})

describe('revokeOutcomeMessage', () => {
  test('contains revoked count + notified', () => {
    const msg = revokeOutcomeMessage('First Steps', 5)
    expect(msg).toContain('5 students')
    expect(msg).toContain('notified')
  })
})

describe('shouldDisableEmailCheckbox', () => {
  test('disabled when email not verified', () => {
    const result = shouldDisableEmailCheckbox(false)
    expect(result.disabled).toBe(true)
    expect(result.reason).toBe('No verified email on this account')
  })
  test('enabled when email verified', () => {
    const result = shouldDisableEmailCheckbox(true)
    expect(result.disabled).toBe(false)
    expect(result.reason).toBeNull()
  })
})

describe('manualAwardConflictMessage', () => {
  test('names student, badge, awardedBy, awardedAt', () => {
    const msg = manualAwardConflictMessage(
      'Tigist M.',
      'First Steps',
      'nightly evaluation',
      '6:00 PM EAT',
    )
    expect(msg).toContain('Tigist M.')
    expect(msg).toContain('First Steps')
    expect(msg).toContain('nightly evaluation')
    expect(msg).toContain('6:00 PM EAT')
  })
})
