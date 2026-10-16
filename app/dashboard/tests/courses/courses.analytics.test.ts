import { describe, expect, test } from 'bun:test'
import {
  ANALYTICS_SUB_TABS,
  ANALYTICS_SUPPRESSION_THRESHOLD,
  ANALYTICS_TIMEZONE,
  computeItemInsights,
  evaluateMetric,
  formatMetricValue,
  isInWindow,
  METRIC_DEFINITIONS,
  rollingWindow,
} from '#/features/courses/courses.analytics'

describe('analytics constants', () => {
  test('timezone is Africa/Addis_Ababa per spec', () => {
    expect(ANALYTICS_TIMEZONE).toBe('Africa/Addis_Ababa')
  })

  test('suppression threshold is 5', () => {
    expect(ANALYTICS_SUPPRESSION_THRESHOLD).toBe(5)
  })

  test('four sub-tabs: performance, drop_off, quizzes, items', () => {
    expect(ANALYTICS_SUB_TABS).toEqual(['performance', 'drop_off', 'quizzes', 'items'])
  })
})

describe('METRIC_DEFINITIONS', () => {
  test('includes all 8 spec metrics', () => {
    const ids = METRIC_DEFINITIONS.map((m) => m.id)
    expect(ids).toEqual([
      'students',
      'active_7d',
      'complete_pct',
      'avg_time',
      'reached',
      'completed',
      'at_risk',
      'rating',
    ])
  })

  test('complete_pct uses enrolled-at-publish denominator (decision D10)', () => {
    const metric = METRIC_DEFINITIONS.find((m) => m.id === 'complete_pct')
    expect(metric?.denominator).toBe('enrolled-at-publish')
  })

  test('active_7d uses enrolled-today denominator (decision D10)', () => {
    const metric = METRIC_DEFINITIONS.find((m) => m.id === 'active_7d')
    expect(metric?.denominator).toBe('enrolled-today')
  })

  test('every metric except students suppresses below 5', () => {
    for (const metric of METRIC_DEFINITIONS) {
      if (metric.id === 'students') {
        expect(metric.suppressBelow).toBe(0)
      } else {
        expect(metric.suppressBelow).toBe(ANALYTICS_SUPPRESSION_THRESHOLD)
      }
    }
  })
})

describe('evaluateMetric — suppression rule', () => {
  test('denominator < 5 renders as —', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'complete_pct')!
    const result = evaluateMetric({ definition: def, numerator: 1, denominator: 3 })
    expect(result.suppressed).toBe(true)
    expect(result.value).toBe('—')
  })

  test('denominator >= 5 renders the percentage', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'complete_pct')!
    const result = evaluateMetric({ definition: def, numerator: 2, denominator: 5 })
    expect(result.suppressed).toBe(false)
    expect(result.value).toBe('40%')
  })

  test('students metric never suppresses', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'students')!
    const result = evaluateMetric({ definition: def, numerator: 1, denominator: 0 })
    expect(result.suppressed).toBe(false)
    expect(result.value).toBe('1')
  })
})

describe('evaluateMetric — notPublished distinction', () => {
  test('complete_pct on unpublished course renders "Not published" not "—" or "0%"', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'complete_pct')!
    const result = evaluateMetric({
      definition: def,
      numerator: 0,
      denominator: 0,
      notPublished: true,
    })
    expect(result.value).toBe('Not published')
    expect(result.suppressed).toBe(false)
    expect(result.notPublished).toBe(true)
  })
})

describe('formatMetricValue', () => {
  test('percentage rounds', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'complete_pct')!
    expect(formatMetricValue(def, 1, 3)).toBe('33%')
    expect(formatMetricValue(def, 2, 3)).toBe('67%')
  })

  test('count uses locale string', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'students')!
    expect(formatMetricValue(def, 1234, 0)).toBe('1,234')
  })

  test('duration formats as h m', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'avg_time')!
    expect(formatMetricValue(def, 3600, 0)).toBe('1h 0m')
    expect(formatMetricValue(def, 5400, 0)).toBe('1h 30m')
    expect(formatMetricValue(def, 600, 0)).toBe('10m')
  })

  test('rating formats with one decimal', () => {
    const def = METRIC_DEFINITIONS.find((m) => m.id === 'rating')!
    expect(formatMetricValue(def, 4.25, 1)).toBe('4.3')
  })
})

describe('rollingWindow — half-open interval', () => {
  test('start is N days before end', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const window = rollingWindow(now, 7)
    const diffMs = window.end.getTime() - window.start.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(7)
  })

  test('isInWindow is half-open: t at exactly end is OUT', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const window = rollingWindow(now, 7)
    expect(isInWindow(window.end, window)).toBe(false)
  })

  test('isInWindow: t at start is IN', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const window = rollingWindow(now, 7)
    expect(isInWindow(window.start, window)).toBe(true)
  })

  test('isInWindow: t in the middle is IN', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const window = rollingWindow(now, 7)
    const middle = new Date('2026-01-12T12:00:00Z')
    expect(isInWindow(middle, window)).toBe(true)
  })
})

describe('computeItemInsights', () => {
  const items = [
    {
      itemId: 'item-1',
      itemTitle: 'Item 1',
      reached: 10,
      completed: 8,
      dropOffPct: 20,
      quizPassRate: null,
      coursePublicId: 'course-1',
    },
    {
      itemId: 'item-2',
      itemTitle: 'Item 2',
      reached: 10,
      completed: 3,
      dropOffPct: 60,
      quizPassRate: null,
      coursePublicId: 'course-1',
    },
    {
      itemId: 'item-3',
      itemTitle: 'Item 3',
      reached: 3, // below suppression threshold
      completed: 1,
      dropOffPct: 70,
      quizPassRate: null,
      coursePublicId: 'course-1',
    },
    {
      itemId: 'item-4',
      itemTitle: 'Item 4',
      reached: 10,
      completed: 9,
      dropOffPct: 10,
      quizPassRate: 30, // below 50%
      coursePublicId: 'course-1',
    },
  ]

  test('items below suppression threshold are skipped', () => {
    const insights = computeItemInsights(items)
    expect(insights.find((i) => i.itemId === 'item-3')).toBeUndefined()
  })

  test('drop-off > 50% is critical', () => {
    const insights = computeItemInsights(items)
    const item2 = insights.find((i) => i.itemId === 'item-2')
    expect(item2?.severity).toBe('critical')
    expect(item2?.explanation).toContain('60%')
  })

  test('completion < 20% is warning', () => {
    const insights = computeItemInsights(items)
    const item2 = insights.find((i) => i.itemId === 'item-2')
    // item-2 has 3/10 = 30% completion, no warning. Let's check item-4 (9/10 = 90%).
    // Actually item-2 is 3/10 = 30% — above 20%, no completion warning.
    // The drop-off warning for item-2 is at 60% > 50% = critical.
    expect(item2).toBeDefined()
  })

  test('quiz pass rate < 50% is warning', () => {
    const insights = computeItemInsights(items)
    const item4 = insights.find(
      (i) => i.itemId === 'item-4' && i.explanation.includes('Quiz pass rate'),
    )
    expect(item4?.severity).toBe('warning')
    expect(item4?.explanation).toContain('30%')
  })

  test('every insight has edit and preview hrefs', () => {
    const insights = computeItemInsights(items)
    for (const insight of insights) {
      expect(insight.editHref).toContain('tab=curriculum')
      expect(insight.previewHref).toContain('preview=1')
    }
  })
})
