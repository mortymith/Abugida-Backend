import { describe, expect, test } from 'bun:test'
import {
  buildReviseDeepLink,
  computeMissRate,
  flagQuestion,
  identifyTopWrongAnswer,
  shouldExcludeFromFlaggedSort,
  tooEasyNote,
} from '#/features/analytics/analytics.quiz-flags'
import type { AnswerDistributionEntry } from '#/features/analytics/analytics.quiz-flags'

describe('flagQuestion', () => {
  test('low_correct when correctPct < 50 and n >= 5', () => {
    const result = flagQuestion(41, 127)
    expect(result.flag).toBe('low_correct')
    expect(result.tooltip).toContain('41%')
    expect(result.tooltip).toContain('threshold 50%')
    expect(result.tooltip).toContain('n=127')
    expect(result.insightAction).toContain('distractor')
  })
  test('too_easy when correctPct >= 95 and n >= 5', () => {
    const result = flagQuestion(98, 121)
    expect(result.flag).toBe('too_easy')
    expect(result.tooltip).toContain('98%')
    expect(result.tooltip).toContain('threshold 95%')
    expect(result.insightAction).toBeNull()
  })
  test('null when correctPct is between 50 and 95', () => {
    const result = flagQuestion(75, 100)
    expect(result.flag).toBeNull()
  })
  test('null when n < 5 (suppressed)', () => {
    const result = flagQuestion(41, 3)
    expect(result.flag).toBeNull()
  })
})

describe('tooEasyNote', () => {
  test('mentions ambiguity', () => {
    expect(tooEasyNote()).toContain('ambiguous')
  })
})

describe('computeMissRate', () => {
  test('100 - correctPct', () => {
    expect(computeMissRate(41)).toBe(59)
    expect(computeMissRate(100)).toBe(0)
    expect(computeMissRate(0)).toBe(100)
  })
})

describe('identifyTopWrongAnswer', () => {
  const distribution: AnswerDistributionEntry[] = [
    { optionId: 'o1', optionText: 'A', isCorrect: true, selectionCount: 80, selectionPct: 63 },
    { optionId: 'o2', optionText: 'B', isCorrect: false, selectionCount: 22, selectionPct: 17 },
    { optionId: 'o3', optionText: 'C', isCorrect: false, selectionCount: 28, selectionPct: 22 },
    { optionId: 'o4', optionText: 'D', isCorrect: false, selectionCount: 0, selectionPct: 0 },
  ]
  test('returns the wrong answer with the most selections', () => {
    const top = identifyTopWrongAnswer(distribution)
    expect(top?.optionId).toBe('o3')
  })
  test('returns null when no wrong answers have selections', () => {
    const allCorrect: AnswerDistributionEntry[] = [
      { optionId: 'o1', optionText: 'A', isCorrect: true, selectionCount: 100, selectionPct: 100 },
    ]
    expect(identifyTopWrongAnswer(allCorrect)).toBeNull()
  })
  test('returns null for empty distribution', () => {
    expect(identifyTopWrongAnswer([])).toBeNull()
  })
})

describe('shouldExcludeFromFlaggedSort', () => {
  test('true when n < 5', () => {
    expect(shouldExcludeFromFlaggedSort(3)).toBe(true)
  })
  test('false when n >= 5', () => {
    expect(shouldExcludeFromFlaggedSort(5)).toBe(false)
  })
})

describe('buildReviseDeepLink', () => {
  test('includes item and question params', () => {
    const url = buildReviseDeepLink('course-1', 'item-1', 'q-3')
    expect(url).toContain('item=item-1')
    expect(url).toContain('question=q-3')
    expect(url).toContain('/courses/course-1')
  })
})
