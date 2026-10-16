/**
 * Badge scope + revoke logic (spec 06 § S-4.7).
 *
 * The spec:
 * - "Scope is required on every badge: Global (any course) or Per-course
 *   (one chosen course). A streak or completion badge scoped to a course
 *   only fires for that course."
 * - "Revoked: distinct from Archived. Archived means the badge is no
 *   longer configured but its history is retained. Revoked means the
 *   badge was wrongly awarded and the award is withdrawn: the student's
 *   award is removed, the student is notified, and the revocation is
 *   written to the audit log."
 */

export type BadgeScopeKind = 'global' | 'course'

export const BADGE_SCOPE_LABELS: Record<BadgeScopeKind, string> = {
  global: 'All courses',
  course: 'Per-course',
}

export interface BadgeScope {
  readonly kind: BadgeScopeKind
  readonly courseId: string | null
  readonly courseName: string | null
}

/**
 * The scope label for the badge card. "Scope: All courses" or "Scope:
 * TOEFL Complete".
 */
export function badgeScopeLabel(scope: BadgeScope): string {
  if (scope.kind === 'global') return 'All courses'
  return scope.courseName ?? 'Per-course'
}

/**
 * Whether a badge applies to a given course. A global badge applies to
 * all courses; a per-course badge applies only to its scoped course.
 */
export function badgeAppliesToCourse(scope: BadgeScope, courseId: string): boolean {
  if (scope.kind === 'global') return true
  return scope.courseId === courseId
}

/**
 * Validate a badge scope. A `global` scope must have no `courseId`; a
 * `course` scope must have a `courseId`.
 */
export function validateBadgeScope(scope: BadgeScope): string | null {
  if (scope.kind === 'global' && scope.courseId !== null) {
    return 'A global badge must not have a course scope.'
  }
  if (scope.kind === 'course' && scope.courseId === null) {
    return 'A per-course badge must specify a course.'
  }
  return null
}

// ── Revoke vs Archive ──────────────────────────────────────────────────────

export type BadgeAwardState = 'active' | 'revoked' | 'archived'

export const BADGE_AWARD_STATE_LABELS: Record<BadgeAwardState, string> = {
  active: 'Active',
  revoked: 'Revoked',
  archived: 'Archived',
}

export interface BadgeAward {
  readonly id: string
  readonly badgeId: string
  readonly studentId: string
  readonly state: BadgeAwardState
  readonly revokedAt: number | null
  readonly revokedBy: string | null
  readonly revokeReason: string | null
}

/**
 * Whether a badge award is visible to the student. The spec: "Revoked
 * removes the award from the student." A revoked award is filtered out
 * of student-facing views (S-4.3 Progress Dashboard).
 */
export function isAwardVisible(award: BadgeAward): boolean {
  return award.state === 'active'
}

/**
 * Whether a badge award can be revoked. Only active awards can be revoked.
 */
export function canRevokeAward(award: BadgeAward): boolean {
  return award.state === 'active'
}

/**
 * The revoke confirmation message. The spec: "Revoke First Steps? This
 * will remove the badge from 1,842 students and notify each of them."
 */
export function revokeConfirmationMessage(badgeName: string, affectedCount: number): string {
  const noun = affectedCount === 1 ? 'student' : 'students'
  return `Revoke ${badgeName}? This will remove the badge from ${affectedCount} ${noun} and notify each of them.`
}

/**
 * The revoke outcome message. The spec: the revocation is written to the
 * audit log with the actor and reason.
 */
export function revokeOutcomeMessage(badgeName: string, revokedCount: number): string {
  const noun = revokedCount === 1 ? 'student' : 'students'
  return `Revoked ${badgeName} from ${revokedCount} ${noun}. Each has been notified.`
}

/**
 * Whether the email notification checkbox should be disabled for a
 * student. The spec: "The email checkbox is disabled with the reason 'No
 * verified email on this account' for a student with no verified
 * address, never hidden."
 */
export function shouldDisableEmailCheckbox(emailVerified: boolean): {
  disabled: boolean
  reason: string | null
} {
  if (!emailVerified) {
    return {
      disabled: true,
      reason: 'No verified email on this account',
    }
  }
  return { disabled: false, reason: null }
}

/**
 * Whether a manual award should be blocked because the student was
 * already auto-awarded. The spec: "A manual award to a student who was
 * just awarded the same badge by the nightly sweep reports 'Tigist M.
 * already has First Steps (awarded by the nightly evaluation at 6:00 PM
 * EAT)' rather than double-awarding."
 */
export function manualAwardConflictMessage(
  studentName: string,
  badgeName: string,
  awardedBy: string,
  awardedAt: string,
): string {
  return `${studentName} already has ${badgeName} (awarded by ${awardedBy} at ${awardedAt})`
}
