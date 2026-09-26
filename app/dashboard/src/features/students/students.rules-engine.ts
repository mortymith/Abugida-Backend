import type { DryRunItem } from './students.types'

/**
 * Pure rule-engine evaluation for S-4.8 (spec 06). The server impl resolves
 * the candidate set per trigger, then defers ordering/skip/capacity logic
 * here so the semantics (dry run, run log, capacity stop) are testable.
 */

export interface RuleSpec {
  triggerKind: 'course_completed' | 'tag_added' | 'cohort_assigned' | 'account_created'
  minQuizAvgPercent: number | null
}

export interface RuleCandidate {
  studentId: string
  studentName: string
  /** Average quiz score % across the trigger course (null = no attempts). */
  quizAvgPercent: number | null
  alreadyEnrolledInTarget: boolean
}

export interface RuleOutcome {
  willEnroll: RuleCandidate[]
  willSkip: Array<{ candidate: RuleCandidate; reason: string }>
}

export const RULE_SKIP_REASONS = {
  alreadyEnrolled: 'already enrolled',
  quizBelow: 'quiz average below threshold',
  capacityReached: 'capacity reached',
} as const

/**
 * Evaluate candidates against a rule. Ordered, deterministic: enrolled
 * students are skipped first, then the AND quiz condition, then capacity
 * (rules stop enrolling once capacity is reached instead of overfilling).
 * `capacityLeft` null = unlimited; `matchedLimit` caps returned items for
 * previews/run logs while counts stay full.
 */
export function evaluateRuleCandidates(
  spec: RuleSpec,
  candidates: RuleCandidate[],
  capacityLeft: number | null,
): RuleOutcome {
  const willEnroll: RuleCandidate[] = []
  const willSkip: RuleOutcome['willSkip'] = []
  let seats = capacityLeft

  for (const candidate of candidates) {
    if (candidate.alreadyEnrolledInTarget) {
      willSkip.push({ candidate, reason: RULE_SKIP_REASONS.alreadyEnrolled })
      continue
    }
    if (
      spec.minQuizAvgPercent != null &&
      (candidate.quizAvgPercent == null || candidate.quizAvgPercent < spec.minQuizAvgPercent)
    ) {
      willSkip.push({ candidate, reason: RULE_SKIP_REASONS.quizBelow })
      continue
    }
    if (seats != null && seats <= 0) {
      willSkip.push({ candidate, reason: RULE_SKIP_REASONS.capacityReached })
      continue
    }
    if (seats != null) seats -= 1
    willEnroll.push(candidate)
  }
  return { willEnroll, willSkip }
}

/** Project a rule outcome into the dry-run DTO (S-4.8 preview list). */
export function toDryRunItems(outcome: RuleOutcome, limit = 100): DryRunItem[] {
  const enrollItems: DryRunItem[] = outcome.willEnroll.slice(0, limit).map((candidate) => ({
    studentId: candidate.studentId,
    studentName: candidate.studentName,
    outcome: 'will_enroll',
    reason: 'matches rule',
  }))
  const skipItems: DryRunItem[] = outcome.willSkip
    .slice(0, Math.max(0, limit - enrollItems.length))
    .map(({ candidate, reason }) => ({
      studentId: candidate.studentId,
      studentName: candidate.studentName,
      outcome: 'will_skip',
      reason,
    }))
  return [...enrollItems, ...skipItems]
}

/** S-4.8 validation: a rule cannot target its own trigger course. */
export function validateRuleNotSelfLoop(
  triggerKind: RuleSpec['triggerKind'],
  triggerCoursePublicId: string | null,
  targetCoursePublicId: string,
): void {
  if (triggerKind === 'course_completed' && triggerCoursePublicId === targetCoursePublicId) {
    throw new Error('RULE_SELF_LOOP: a rule cannot enroll into its own trigger course')
  }
}
