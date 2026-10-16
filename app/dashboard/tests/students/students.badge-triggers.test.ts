import { describe, expect, test } from 'bun:test'
import {
  matchesBadgeTrigger,
  triggerPreviewMessage,
} from '#/features/students/students.badge-triggers'
import {
  evaluateRuleCandidates,
  toDryRunItems,
  validateRuleNotSelfLoop,
} from '#/features/students/students.rules-engine'

describe('badge trigger matching', () => {
  const base = {
    alreadyAwarded: false,
    activityDays: ['2026-09-01'] as string[],
    hasPerfectQuiz: false,
    completedCoursePublicIds: [] as string[],
    streakDays: 0,
  }

  test('first_lesson matches any lesson activity', () => {
    expect(
      matchesBadgeTrigger({ triggerKind: 'first_lesson', days: null }, { ...base, streakDays: 0 }),
    ).toBe(true)
    expect(
      matchesBadgeTrigger(
        { triggerKind: 'first_lesson', days: null },
        { ...base, activityDays: [], streakDays: 0 },
      ),
    ).toBe(false)
  })

  test('streak matches at/above the configured days only', () => {
    const spec = { triggerKind: 'streak' as const, days: 7 }
    expect(matchesBadgeTrigger(spec, { ...base, streakDays: 7 })).toBe(true)
    expect(matchesBadgeTrigger(spec, { ...base, streakDays: 6 })).toBe(false)
  })

  test('streak without configured days never matches', () => {
    expect(
      matchesBadgeTrigger({ triggerKind: 'streak', days: null }, { ...base, streakDays: 30 }),
    ).toBe(false)
  })

  test('quiz_perfect and course_completed', () => {
    expect(
      matchesBadgeTrigger(
        { triggerKind: 'quiz_perfect', days: null },
        { ...base, hasPerfectQuiz: true },
      ),
    ).toBe(true)
    expect(
      matchesBadgeTrigger(
        { triggerKind: 'course_completed', days: null },
        { ...base, completedCoursePublicIds: ['c1'] },
      ),
    ).toBe(true)
  })

  test('manual trigger never auto-matches', () => {
    expect(
      matchesBadgeTrigger(
        { triggerKind: 'manual', days: null },
        { ...base, hasPerfectQuiz: true, completedCoursePublicIds: ['c1'], streakDays: 99 },
      ),
    ).toBe(false)
  })

  test('already-awarded students never re-match', () => {
    expect(
      matchesBadgeTrigger(
        { triggerKind: 'first_lesson', days: null },
        { ...base, alreadyAwarded: true },
      ),
    ).toBe(false)
  })

  test('preview message formats counts', () => {
    expect(triggerPreviewMessage(1)).toContain('1 student matches')
    expect(triggerPreviewMessage(1842)).toContain('1,842 students match')
  })
})

describe('rule candidate evaluation', () => {
  const spec = { triggerKind: 'course_completed' as const, minQuizAvgPercent: null }
  const candidate = (
    overrides: Partial<{
      studentId: string
      quizAvgPercent: number | null
      alreadyEnrolledInTarget: boolean
    }>,
  ) => ({
    studentId: 's1',
    studentName: 'Alem',
    quizAvgPercent: null,
    alreadyEnrolledInTarget: false,
    ...overrides,
  })

  test('clean candidate will enroll', () => {
    const outcome = evaluateRuleCandidates(spec, [candidate({})], null)
    expect(outcome.willEnroll).toHaveLength(1)
    expect(outcome.willSkip).toHaveLength(0)
  })

  test('already-enrolled students are skipped', () => {
    const outcome = evaluateRuleCandidates(
      spec,
      [candidate({ alreadyEnrolledInTarget: true })],
      null,
    )
    expect(outcome.willEnroll).toHaveLength(0)
    expect(outcome.willSkip[0]?.reason).toBe('already enrolled')
  })

  test('AND quiz condition filters below-threshold candidates', () => {
    const outcome = evaluateRuleCandidates(
      { triggerKind: 'course_completed', minQuizAvgPercent: 80 },
      [
        candidate({ quizAvgPercent: 70 }),
        candidate({ quizAvgPercent: 90 }),
        candidate({ quizAvgPercent: null }),
      ],
      null,
    )
    expect(outcome.willEnroll.map((c) => c.quizAvgPercent)).toEqual([90])
    expect(outcome.willSkip).toHaveLength(2)
  })

  test('capacity stops enrolling instead of overfilling', () => {
    const outcome = evaluateRuleCandidates(
      spec,
      [candidate({ studentId: 'a' }), candidate({ studentId: 'b' }), candidate({ studentId: 'c' })],
      2,
    )
    expect(outcome.willEnroll).toHaveLength(2)
    expect(outcome.willSkip[0]?.reason).toBe('capacity reached')
  })

  test('dry-run DTO projects outcomes with reasons', () => {
    const outcome = evaluateRuleCandidates(
      spec,
      [candidate({ studentId: 'a' }), candidate({ studentId: 'b', alreadyEnrolledInTarget: true })],
      null,
    )
    const items = toDryRunItems(outcome)
    expect(items[0]).toMatchObject({ studentId: 'a', outcome: 'will_enroll' })
    expect(items[1]).toMatchObject({
      studentId: 'b',
      outcome: 'will_skip',
      reason: 'already enrolled',
    })
  })
})

describe('rule self-loop validation', () => {
  test('course_completed trigger on the target course throws', () => {
    expect(() => validateRuleNotSelfLoop('course_completed', 'course-a', 'course-a')).toThrow(
      /RULE_SELF_LOOP/,
    )
  })

  test('different trigger/target course passes', () => {
    expect(() => validateRuleNotSelfLoop('course_completed', 'course-a', 'course-b')).not.toThrow()
    expect(() => validateRuleNotSelfLoop('tag_added', null, 'course-a')).not.toThrow()
  })
})
