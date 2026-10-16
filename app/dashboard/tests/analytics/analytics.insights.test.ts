import { describe, expect, test } from 'bun:test'
import {
  buildInsights,
  INSIGHT_ACTION_LABELS,
  shouldShowInsight,
} from '#/features/analytics/analytics.insights'
import { buildItemEngagementRows } from '#/features/analytics/analytics.item-engagement'
import type { ItemEngagementInput } from '#/features/analytics/analytics.item-engagement'

const flagged: ItemEngagementInput = {
  itemId: 'i1',
  itemTitle: 'Test format',
  sectionLabel: 'S2',
  itemKind: 'lesson',
  visibility: 'published',
  reach: 228,
  completed: 93,
  avgTimeSeconds: 240,
  quizAvgPct: null,
  quizN: 0,
}
const notFlagged: ItemEngagementInput = {
  itemId: 'i2',
  itemTitle: 'Intro',
  sectionLabel: 'S1',
  itemKind: 'lesson',
  visibility: 'published',
  reach: 231,
  completed: 222,
  avgTimeSeconds: 660,
  quizAvgPct: null,
  quizN: 0,
}
const smallN: ItemEngagementInput = {
  itemId: 'i3',
  itemTitle: 'Small',
  sectionLabel: 'S4',
  itemKind: 'lesson',
  visibility: 'published',
  reach: 3,
  completed: 1,
  avgTimeSeconds: 120,
  quizAvgPct: null,
  quizN: 0,
}

describe('buildInsights', () => {
  test('renders insight for flagged item with enough n', () => {
    const rows = buildItemEngagementRows([flagged])
    const insights = buildInsights(rows, 'last 30 days')
    expect(insights).toHaveLength(1)
    expect(insights[0].itemId).toBe('i1')
    expect(insights[0].n).toBe(228)
    expect(insights[0].actions).toContain('edit_item')
    expect(insights[0].actions).toContain('preview_as_student')
  })
  test('no insight for non-flagged item', () => {
    const rows = buildItemEngagementRows([notFlagged])
    const insights = buildInsights(rows, 'last 30 days')
    expect(insights).toHaveLength(0)
  })
  test('no insight when n < MIN_INSIGHT_N', () => {
    const rows = buildItemEngagementRows([smallN])
    const insights = buildInsights(rows, 'last 30 days')
    expect(insights).toHaveLength(0)
  })
  test('insight includes the window', () => {
    const rows = buildItemEngagementRows([flagged])
    const insights = buildInsights(rows, 'last 7 days')
    expect(insights[0].window).toBe('last 7 days')
    expect(insights[0].explanation).toContain('last 7 days')
  })
  test('quiz miss-rate insight includes append_distractor action', () => {
    const insights = buildInsights([], 'last 30 days', [
      {
        itemId: 'q1',
        itemTitle: 'Q3',
        metric: 'quiz_miss_rate',
        value: '59%',
        n: 127,
        window: 'last 30 days',
        explanation: '59% miss rate',
      },
    ])
    expect(insights).toHaveLength(1)
    expect(insights[0].actions).toContain('append_distractor')
  })
})

describe('shouldShowInsight', () => {
  test('true when n >= 5', () => expect(shouldShowInsight(5)).toBe(true))
  test('false when n < 5', () => expect(shouldShowInsight(4)).toBe(false))
})

describe('INSIGHT_ACTION_LABELS', () => {
  test('three actions', () => {
    expect(Object.keys(INSIGHT_ACTION_LABELS)).toHaveLength(3)
    expect(INSIGHT_ACTION_LABELS.edit_item).toBe('Edit item')
  })
})
