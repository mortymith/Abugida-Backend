import type { BadgeTrigger } from '@abugida/database/learning'

/**
 * Pure badge-trigger evaluation for S-4.7 (spec 06). The server impl gathers
 * per-student event data and defers the decision here so trigger semantics
 * are unit-testable without a database.
 */

export interface BadgeTriggerSpec {
  triggerKind: BadgeTrigger
  /** Streak trigger only: required consecutive activity days. */
  days: number | null
}

export interface BadgeTriggerCandidate {
  studentId: string
  studentName: string
  studentEmail: string
  /** UTC day keys (sorted asc) with any lesson activity. */
  activityDays: string[]
  hasPerfectQuiz: boolean
  /** Course public ids the student has fully completed. */
  completedCoursePublicIds: string[]
  /** Students holding the award already never re-match. */
  alreadyAwarded: boolean
  /** Optional guard: only candidates enrolled in this course (per-badge scope). */
  scopeCoursePublicIds?: string[]
}

/**
 * Decide whether a single candidate matches a badge trigger.
 * - first_lesson: at least one lesson completion ever
 * - streak: current/longest streak ≥ configured days (caller supplies streak)
 * - quiz_perfect: any quiz attempt with a 100% score
 * - course_completed: any completed course
 * - manual: never auto-awarded
 */
export function matchesBadgeTrigger(
  spec: BadgeTriggerSpec,
  candidate: Pick<
    BadgeTriggerCandidate,
    'activityDays' | 'hasPerfectQuiz' | 'completedCoursePublicIds' | 'alreadyAwarded'
  > & { streakDays: number },
): boolean {
  if (candidate.alreadyAwarded) return false
  switch (spec.triggerKind) {
    case 'first_lesson':
      return candidate.activityDays.length > 0
    case 'streak':
      return spec.days != null && candidate.streakDays >= spec.days
    case 'quiz_perfect':
      return candidate.hasPerfectQuiz
    case 'course_completed':
      return candidate.completedCoursePublicIds.length > 0
    case 'manual':
      return false
  }
}

/**
 * S-4.7 "Creating" state trigger preview copy, e.g.
 * "1,842 students currently match this trigger — they will be awarded on the next evaluation."
 */
export function triggerPreviewMessage(matchedCount: number): string {
  const noun = matchedCount === 1 ? 'student matches' : 'students match'
  return `${matchedCount.toLocaleString()} ${noun} this trigger — they will be awarded on the next evaluation.`
}

export const BADGE_TRIGGER_LABELS: Record<BadgeTrigger, string> = {
  first_lesson: 'First lesson completed',
  streak: 'Streak',
  quiz_perfect: 'Quiz score = 100%',
  course_completed: 'Course completed',
  manual: 'Manual award',
}
