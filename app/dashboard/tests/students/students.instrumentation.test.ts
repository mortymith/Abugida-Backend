import { describe, expect, test } from 'bun:test'
import {
  breachesStudentsBudget,
  STUDENTS_INSTRUMENTATION_EVENTS,
  STUDENTS_PERFORMANCE_BUDGETS,
  trackStudentsEvent,
  validateStudentsPayload,
} from '#/features/students/students.instrumentation'
import type {
  StudentsInstrumentationEvent,
  StudentsInstrumentationPayload,
} from '#/features/students/students.instrumentation'

describe('STUDENTS_INSTRUMENTATION_EVENTS', () => {
  test('includes events for all 8 screens', () => {
    const required: StudentsInstrumentationEvent[] = [
      'students_export_requested',
      'student_profile_viewed',
      'student_progress_viewed',
      'cohort_viewed',
      'message_sent',
      'enrollment_request_approved',
      'badge_awarded',
      'rule_sweep_run',
    ]
    for (const event of required) {
      expect(STUDENTS_INSTRUMENTATION_EVENTS).toContain(event)
    }
  })
})

describe('validateStudentsPayload', () => {
  test('valid payload with id and count', () => {
    const payload: StudentsInstrumentationPayload = { id: 'student-123', count: 5 }
    expect(validateStudentsPayload(payload)).toBeNull()
  })

  test('rejects empty id', () => {
    const payload: StudentsInstrumentationPayload = { id: '' }
    expect(validateStudentsPayload(payload)).toContain('non-empty')
  })

  test('rejects name (PII leak)', () => {
    const payload = { id: 'student-123', name: 'Alemayehu' } as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toContain('name')
  })

  test('rejects handle (PII leak)', () => {
    const payload = { id: 'student-123', handle: '@alemayehu' } as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toContain('handle')
  })

  test('rejects email (PII leak)', () => {
    const payload = { id: 'student-123', email: 'a@b.com' } as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toContain('email')
  })

  test('rejects messageText (content leak)', () => {
    const payload = { id: 'student-123', messageText: 'Hi there' } as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toContain('messageText')
  })

  test('rejects tags (content leak)', () => {
    const payload = { id: 'student-123', tags: ['toefl'] } as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toContain('tags')
  })

  test('rejects non-number count', () => {
    const payload = {
      id: 'student-123',
      count: 'five',
    } as unknown as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toContain('number')
  })

  test('allows reasonCode (not in forbidden list)', () => {
    const payload = {
      id: 'student-123',
      reasonCode: 'course_full',
    } as StudentsInstrumentationPayload
    expect(validateStudentsPayload(payload)).toBeNull()
  })
})

describe('trackStudentsEvent', () => {
  test('calls send when payload is valid', () => {
    const sent: Array<{ event: string; payload: StudentsInstrumentationPayload }> = []
    trackStudentsEvent(
      'student_profile_viewed',
      { id: 'student-123', count: 4 },
      (event, payload) => sent.push({ event, payload }),
    )
    expect(sent).toHaveLength(1)
    expect(sent[0].event).toBe('student_profile_viewed')
  })

  test('does not call send when payload is invalid', () => {
    const sent: Array<{ event: string; payload: StudentsInstrumentationPayload }> = []
    trackStudentsEvent('student_profile_viewed', { id: '' }, (event, payload) =>
      sent.push({ event, payload }),
    )
    expect(sent).toHaveLength(0)
  })
})

describe('STUDENTS_PERFORMANCE_BUDGETS', () => {
  test('directory LCP budget is 1500ms', () => {
    expect(STUDENTS_PERFORMANCE_BUDGETS.directory_lcp_25_rows).toBe(1500)
  })

  test('rules cycle detection budget is 100ms', () => {
    expect(STUDENTS_PERFORMANCE_BUDGETS.rules_cycle_detection).toBe(100)
  })
})

describe('breachesStudentsBudget', () => {
  test('true when duration exceeds budget', () => {
    expect(breachesStudentsBudget('directory_lcp_25_rows', 2000)).toBe(true)
  })

  test('false when under budget', () => {
    expect(breachesStudentsBudget('directory_lcp_25_rows', 1000)).toBe(false)
  })

  test('false for unknown metric', () => {
    expect(breachesStudentsBudget('unknown', 99999)).toBe(false)
  })
})
