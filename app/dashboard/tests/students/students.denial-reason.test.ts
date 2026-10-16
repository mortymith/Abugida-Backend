import { describe, expect, test } from 'bun:test'
import {
  canSubmitDenial,
  denialMessageForStudent,
  DENIAL_REASON_REQUIRED_LABEL,
  DENIAL_REASONS,
  DENIAL_REASON_LABELS,
  requiresNote,
  validateDenial,
} from '#/features/students/students.denial-reason'

describe('DENIAL_REASONS', () => {
  test('5 bounded reasons', () => {
    expect(DENIAL_REASONS).toEqual([
      'course_full',
      'prerequisites_not_met',
      'duplicate_request',
      'not_eligible',
      'other',
    ])
  })
  test('every reason has a label', () => {
    for (const reason of DENIAL_REASONS) {
      expect(DENIAL_REASON_LABELS[reason]).toBeTruthy()
    }
  })
})

describe('DENIAL_REASON_REQUIRED_LABEL', () => {
  test('matches spec wording', () => {
    expect(DENIAL_REASON_REQUIRED_LABEL).toBe('Choose a reason — the student sees this.')
  })
})

describe('requiresNote', () => {
  test('true for other', () => {
    expect(requiresNote('other')).toBe(true)
  })
  test('false for bounded reasons', () => {
    expect(requiresNote('course_full')).toBe(false)
    expect(requiresNote('prerequisites_not_met')).toBe(false)
  })
  test('false for null', () => {
    expect(requiresNote(null)).toBe(false)
  })
})

describe('canSubmitDenial', () => {
  test('false when no reason', () => {
    expect(canSubmitDenial(null, '')).toBe(false)
  })
  test('true for bounded reason without note', () => {
    expect(canSubmitDenial('course_full', '')).toBe(true)
  })
  test('false for other without note', () => {
    expect(canSubmitDenial('other', '')).toBe(false)
  })
  test('true for other with note', () => {
    expect(canSubmitDenial('other', 'Custom reason')).toBe(true)
  })
})

describe('validateDenial', () => {
  test('required message when no reason', () => {
    expect(validateDenial(null, '')).toBe(DENIAL_REASON_REQUIRED_LABEL)
  })
  test('note required for other', () => {
    expect(validateDenial('other', '')).toContain('note is required')
  })
  test('null when valid', () => {
    expect(validateDenial('course_full', '')).toBeNull()
    expect(validateDenial('other', 'Custom')).toBeNull()
  })
})

describe('denialMessageForStudent', () => {
  test('bounded reason uses label', () => {
    expect(denialMessageForStudent('course_full', '')).toContain('Course full')
  })
  test('other uses the note', () => {
    expect(denialMessageForStudent('other', 'You need to complete TOEFL first.')).toContain(
      'You need to complete TOEFL first.',
    )
  })
})
