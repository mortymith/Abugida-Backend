import { describe, expect, test } from 'bun:test'
import {
  buildItemEngagementRows,
  isItemEngagementFlagged,
} from '#/features/analytics/analytics.item-engagement'
import type { ItemEngagementInput } from '#/features/analytics/analytics.item-engagement'

const published: ItemEngagementInput = {
  itemId: 'i1',
  itemTitle: 'What is TOEFL?',
  sectionLabel: 'S1',
  itemKind: 'lesson',
  visibility: 'published',
  reach: 231,
  completed: 222,
  avgTimeSeconds: 660,
  quizAvgPct: null,
  quizN: 0,
}
const draft: ItemEngagementInput = {
  itemId: 'i2',
  itemTitle: 'Essay draft',
  sectionLabel: 'S3',
  itemKind: 'assignment',
  visibility: 'draft',
  reach: 0,
  completed: 0,
  avgTimeSeconds: null,
  quizAvgPct: null,
  quizN: 0,
}
const small: ItemEngagementInput = {
  itemId: 'i3',
  itemTitle: 'Small item',
  sectionLabel: 'S4',
  itemKind: 'lesson',
  visibility: 'published',
  reach: 3,
  completed: 1,
  avgTimeSeconds: 120,
  quizAvgPct: null,
  quizN: 0,
}
const quiz: ItemEngagementInput = {
  itemId: 'i4',
  itemTitle: 'Reading Check',
  sectionLabel: 'S2',
  itemKind: 'quiz',
  visibility: 'published',
  reach: 228,
  completed: 93,
  avgTimeSeconds: 240,
  quizAvgPct: 41,
  quizN: 127,
}

describe('buildItemEngagementRows', () => {
  test('published item with enough n renders percentage', () => {
    const rows = buildItemEngagementRows([published])
    expect(rows[0].completionPct).toBe('96%')
    expect(rows[0].n).toBe(231)
  })
  test('draft item reads "unpublished"', () => {
    const rows = buildItemEngagementRows([draft])
    expect(rows[0].completionPct).toBe('unpublished')
    expect(rows[0].avgTimeSeconds).toBeNull()
  })
  test('item with n < 5 renders — for completion', () => {
    const rows = buildItemEngagementRows([small])
    expect(rows[0].completionPct).toBe('—')
    expect(rows[0].avgTimeSeconds).toBeNull()
  })
  test('quiz item renders quiz avg', () => {
    const rows = buildItemEngagementRows([quiz])
    expect(rows[0].quizAvgPct).toBe('41%')
    expect(rows[0].completionPct).toBe('41%')
  })
  test('quiz with n < 5 renders — for quiz avg', () => {
    const smallQuiz: ItemEngagementInput = { ...quiz, quizN: 3 }
    const rows = buildItemEngagementRows([smallQuiz])
    expect(rows[0].quizAvgPct).toBe('—')
  })
})

describe('isItemEngagementFlagged', () => {
  test('true when published, enough n, completion < 50%', () => {
    const rows = buildItemEngagementRows([quiz])
    expect(isItemEngagementFlagged(rows[0])).toBe(true)
  })
  test('false when draft', () => {
    const rows = buildItemEngagementRows([draft])
    expect(isItemEngagementFlagged(rows[0])).toBe(false)
  })
  test('false when n < 5', () => {
    const rows = buildItemEngagementRows([small])
    expect(isItemEngagementFlagged(rows[0])).toBe(false)
  })
  test('false when completion >= 50%', () => {
    const rows = buildItemEngagementRows([published])
    expect(isItemEngagementFlagged(rows[0])).toBe(false)
  })
})
