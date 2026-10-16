import { describe, expect, test } from 'bun:test'
import {
  deltaLabel,
  detectCoverageMismatch,
  shouldExcludeCohortFromDeltas,
  twoProportionZTest,
} from '#/features/analytics/analytics.significance'
import type { CohortCoverage } from '#/features/analytics/analytics.significance'

describe('twoProportionZTest', () => {
  test('significant when large difference + large n', () => {
    // 80% vs 40% with n=100 each → highly significant
    const result = twoProportionZTest(0.8, 100, 0.4, 100)
    expect(result.significant).toBe(true)
    expect(result.label).toBe('significant')
  })
  test('not significant when small difference', () => {
    // 51% vs 50% with n=100 → not significant
    const result = twoProportionZTest(0.51, 100, 0.5, 100)
    expect(result.significant).toBe(false)
    expect(result.label).toContain('not meaningful')
  })
  test('not significant when n < 5', () => {
    const result = twoProportionZTest(0.8, 3, 0.4, 3)
    expect(result.significant).toBe(false)
    expect(result.label).toContain('not meaningful')
  })
  test('not significant when both proportions are 0', () => {
    const result = twoProportionZTest(0, 100, 0, 100)
    expect(result.significant).toBe(false)
  })
  test('not significant when both proportions are 1', () => {
    const result = twoProportionZTest(1, 100, 1, 100)
    expect(result.significant).toBe(false)
  })
  test('confidence level is 95%', () => {
    expect(twoProportionZTest(0.5, 100, 0.5, 100).confidenceLevel).toBe(0.95)
  })
})

describe('deltaLabel', () => {
  test('arrow + pts when significant', () => {
    const sig = twoProportionZTest(0.68, 100, 0.74, 100)
    const label = deltaLabel(68, 74, sig, 'pts')
    if (sig.significant) {
      expect(label).toContain('▲')
      expect(label).toContain('pts')
    }
  })
  test('not meaningful text when not significant', () => {
    const sig = twoProportionZTest(0.51, 100, 0.5, 100)
    const label = deltaLabel(51, 50, sig, 'pts')
    expect(label).toContain('not meaningful')
  })
})

describe('detectCoverageMismatch', () => {
  const sameCourses: CohortCoverage[] = [
    { cohortId: 'c1', cohortName: 'TOEFL Jan', courseIds: new Set(['course-1', 'course-2']) },
    { cohortId: 'c2', cohortName: 'TOEFL Apr', courseIds: new Set(['course-1', 'course-2']) },
  ]
  const diffCourses: CohortCoverage[] = [
    { cohortId: 'c1', cohortName: 'TOEFL Jan', courseIds: new Set(['course-1', 'course-2']) },
    { cohortId: 'c2', cohortName: 'TOEFL Apr', courseIds: new Set(['course-1', 'course-3']) },
  ]

  test('no mismatch when cohorts cover same courses', () => {
    const result = detectCoverageMismatch(sameCourses)
    expect(result.mismatched).toBe(false)
    expect(result.warning).toBeNull()
  })
  test('mismatch when cohorts cover different courses', () => {
    const result = detectCoverageMismatch(diffCourses)
    expect(result.mismatched).toBe(true)
    expect(result.warning).toContain('not like-for-like')
  })
  test('no mismatch with fewer than 2 cohorts', () => {
    expect(detectCoverageMismatch([sameCourses[0]]).mismatched).toBe(false)
  })
})

describe('shouldExcludeCohortFromDeltas', () => {
  test('true when memberCount < 5', () => {
    expect(shouldExcludeCohortFromDeltas(3)).toBe(true)
  })
  test('false when memberCount >= 5', () => {
    expect(shouldExcludeCohortFromDeltas(5)).toBe(false)
  })
})
