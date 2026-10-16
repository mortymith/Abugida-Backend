import { describe, expect, test } from 'bun:test'
import {
  ANALYTICS_INSTRUMENTATION_EVENTS,
  breachesAnalyticsBudget,
  trackAnalyticsEvent,
  validateAnalyticsPayload,
} from '#/features/analytics/analytics.instrumentation'
import type {
  AnalyticsInstrumentationEvent,
  AnalyticsInstrumentationPayload,
} from '#/features/analytics/analytics.instrumentation'

describe('ANALYTICS_INSTRUMENTATION_EVENTS', () => {
  test('includes events for all 5 screens', () => {
    const required: AnalyticsInstrumentationEvent[] = [
      'course_performance_viewed',
      'quiz_analytics_viewed',
      'funnel_viewed',
      'export_configured',
      'cohort_comparison_viewed',
    ]
    for (const event of required) {
      expect(ANALYTICS_INSTRUMENTATION_EVENTS).toContain(event)
    }
  })
})

describe('validateAnalyticsPayload', () => {
  test('valid payload', () => {
    const payload: AnalyticsInstrumentationPayload = { id: 'course-123', count: 234 }
    expect(validateAnalyticsPayload(payload)).toBeNull()
  })
  test('rejects empty id', () => {
    expect(validateAnalyticsPayload({ id: '' })).toContain('non-empty')
  })
  test('rejects name (PII)', () => {
    const payload = { id: 'c1', name: 'Alemayehu' } as AnalyticsInstrumentationPayload
    expect(validateAnalyticsPayload(payload)).toContain('name')
  })
  test('rejects questionText (content leak)', () => {
    const payload = {
      id: 'c1',
      questionText: 'What is the main idea?',
    } as AnalyticsInstrumentationPayload
    expect(validateAnalyticsPayload(payload)).toContain('questionText')
  })
  test('rejects non-number count', () => {
    const payload = { id: 'c1', count: 'five' } as unknown as AnalyticsInstrumentationPayload
    expect(validateAnalyticsPayload(payload)).toContain('number')
  })
})

describe('trackAnalyticsEvent', () => {
  test('calls send when valid', () => {
    const sent: Array<{ event: string }> = []
    trackAnalyticsEvent('course_performance_viewed', { id: 'c1', count: 10 }, (e) =>
      sent.push({ event: e }),
    )
    expect(sent).toHaveLength(1)
  })
  test('does not call send when invalid', () => {
    const sent: Array<{ event: string }> = []
    trackAnalyticsEvent('course_performance_viewed', { id: '' }, (e) => sent.push({ event: e }))
    expect(sent).toHaveLength(0)
  })
})

describe('breachesAnalyticsBudget', () => {
  test('true when over budget', () => {
    expect(breachesAnalyticsBudget('course_performance_lcp', 3000)).toBe(true)
  })
  test('false when under budget', () => {
    expect(breachesAnalyticsBudget('course_performance_lcp', 2000)).toBe(false)
  })
  test('false for unknown metric', () => {
    expect(breachesAnalyticsBudget('unknown', 99999)).toBe(false)
  })
})
