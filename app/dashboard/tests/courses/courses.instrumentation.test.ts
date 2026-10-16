import { describe, expect, test } from 'bun:test'
import {
  breachesBudget,
  COURSE_INSTRUMENTATION_EVENTS,
  PERFORMANCE_BUDGETS,
  trackEvent,
  validatePayload,
} from '#/features/courses/courses.instrumentation'
import type {
  CourseInstrumentationEvent,
  InstrumentationPayload,
} from '#/features/courses/courses.instrumentation'

describe('COURSE_INSTRUMENTATION_EVENTS', () => {
  test('includes the spec events for S-2.1, S-2.6, S-2.17, S-2.18, S-2.19, S-2.7, S-2.22', () => {
    const required: CourseInstrumentationEvent[] = [
      'course_catalog_viewed',
      'workspace_opened',
      'curriculum_tree_loaded',
      'course_roster_viewed',
      'course_analytics_viewed',
      'item_editor_opened',
      'publish_readiness_viewed',
    ]
    for (const event of required) {
      expect(COURSE_INSTRUMENTATION_EVENTS).toContain(event)
    }
  })
})

describe('validatePayload', () => {
  test('valid payload with id and count', () => {
    const payload: InstrumentationPayload = { id: 'course-123', count: 5 }
    expect(validatePayload(payload)).toBeNull()
  })

  test('valid payload with id only', () => {
    const payload: InstrumentationPayload = { id: 'course-123' }
    expect(validatePayload(payload)).toBeNull()
  })

  test('rejects empty id', () => {
    const payload: InstrumentationPayload = { id: '' }
    expect(validatePayload(payload)).toContain('non-empty')
  })

  test('rejects missing id', () => {
    const payload = { count: 5 } as InstrumentationPayload
    expect(validatePayload(payload)).toContain('id')
  })

  test('rejects title (PII / content leak)', () => {
    const payload = { id: 'course-123', title: 'My Course' } as InstrumentationPayload
    expect(validatePayload(payload)).toContain('title')
  })

  test('rejects name (PII)', () => {
    const payload = { id: 'course-123', name: 'Jane Doe' } as InstrumentationPayload
    expect(validatePayload(payload)).toContain('name')
  })

  test('rejects email (PII)', () => {
    const payload = { id: 'course-123', email: 'jane@example.com' } as InstrumentationPayload
    expect(validatePayload(payload)).toContain('email')
  })

  test('rejects body (content leak)', () => {
    const payload = { id: 'course-123', body: 'lesson content' } as InstrumentationPayload
    expect(validatePayload(payload)).toContain('body')
  })

  test('rejects comment (content leak)', () => {
    const payload = { id: 'course-123', comment: 'review comment' } as InstrumentationPayload
    expect(validatePayload(payload)).toContain('comment')
  })

  test('rejects non-number count', () => {
    const payload = { id: 'course-123', count: 'five' } as unknown as InstrumentationPayload
    expect(validatePayload(payload)).toContain('number')
  })
})

describe('trackEvent', () => {
  test('calls send when payload is valid', () => {
    const sent: Array<{ event: string; payload: InstrumentationPayload }> = []
    trackEvent('course_catalog_viewed', { id: 'course-123', count: 5 }, (event, payload) =>
      sent.push({ event, payload }),
    )
    expect(sent).toHaveLength(1)
    expect(sent[0].event).toBe('course_catalog_viewed')
  })

  test('does not call send when payload is invalid', () => {
    const sent: Array<{ event: string; payload: InstrumentationPayload }> = []
    trackEvent('course_catalog_viewed', { id: '' }, (event, payload) =>
      sent.push({ event, payload }),
    )
    expect(sent).toHaveLength(0)
  })
})

describe('PERFORMANCE_BUDGETS', () => {
  test('catalog first paint budget is 1500ms', () => {
    expect(PERFORMANCE_BUDGETS.course_catalog_first_paint).toBe(1500)
  })

  test('lesson editor 200k char hydrate budget is 1500ms', () => {
    expect(PERFORMANCE_BUDGETS.lesson_editor_200k_char_hydrate).toBe(1500)
  })

  test('publish readiness evaluate budget is 1000ms', () => {
    expect(PERFORMANCE_BUDGETS.publish_readiness_evaluate).toBe(1000)
  })
})

describe('breachesBudget', () => {
  test('true when duration exceeds budget', () => {
    expect(breachesBudget('course_catalog_first_paint', 2000)).toBe(true)
  })

  test('false when duration is under budget', () => {
    expect(breachesBudget('course_catalog_first_paint', 1000)).toBe(false)
  })

  test('false when metric has no budget', () => {
    expect(breachesBudget('unknown_metric', 99999)).toBe(false)
  })

  test('false at exactly the budget (boundary)', () => {
    expect(breachesBudget('course_catalog_first_paint', 1500)).toBe(false)
  })
})
