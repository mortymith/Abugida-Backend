import { describe, expect, test } from 'bun:test'
import {
  classifyEdit,
  EDIT_CLASSIFICATION_CONSEQUENCES,
  EDIT_CLASSIFICATION_LABELS,
  optOutLabel,
  reconfirmationMessage,
  reconfirmationStatusLabel,
  reconfirmationTimedOut,
  RECONFIRMATION_TIMEOUT_DAYS,
  shouldTriggerReconfirmation,
  shouldUnlistDuringReconfirmation,
  shouldUnlistOptedOut,
} from '#/features/marketing/marketing.testimonial-rev3'

describe('classifyEdit', () => {
  test('identical → typo', () => {
    expect(classifyEdit('Great course!', 'Great course!')).toBe('typo')
  })
  test('character-level fix → typo', () => {
    expect(classifyEdit('teh best course', 'the best course')).toBe('typo')
  })
  test('minor wording change → light', () => {
    expect(classifyEdit('This was a great course', 'This was an excellent course')).toBe('light')
  })
  test('substantial rewrite → heavy', () => {
    expect(
      classifyEdit(
        'I loved the TOEFL preparation and the teacher was amazing',
        'The course structure needs improvement and some lessons were too short',
      ),
    ).toBe('heavy')
  })
  test('many words added → heavy', () => {
    expect(
      classifyEdit(
        'Good course',
        'Good course overall but I think the listening section could use more practice materials and the speaking exercises felt rushed',
      ),
    ).toBe('heavy')
  })
})
describe('EDIT_CLASSIFICATION_LABELS', () => {
  test('3 types', () => {
    expect(EDIT_CLASSIFICATION_LABELS.typo).toBe('Typo fix')
    expect(EDIT_CLASSIFICATION_LABELS.light).toBe('Light edit')
    expect(EDIT_CLASSIFICATION_LABELS.heavy).toBe('Heavy edit')
  })
})
describe('EDIT_CLASSIFICATION_CONSEQUENCES', () => {
  test('typo → no contact', () =>
    expect(EDIT_CLASSIFICATION_CONSEQUENCES.typo).toContain('No contact'))
  test('light → notified', () =>
    expect(EDIT_CLASSIFICATION_CONSEQUENCES.light).toContain('notified'))
  test('heavy → re-confirmation', () =>
    expect(EDIT_CLASSIFICATION_CONSEQUENCES.heavy).toContain('Re-confirmation'))
})
describe('shouldTriggerReconfirmation', () => {
  test('true for heavy', () => expect(shouldTriggerReconfirmation('heavy')).toBe(true))
  test('false for typo', () => expect(shouldTriggerReconfirmation('typo')).toBe(false))
  test('false for light', () => expect(shouldTriggerReconfirmation('light')).toBe(false))
})
describe('reconfirmationStatusLabel', () => {
  test('pending', () => expect(reconfirmationStatusLabel('pending')).toContain('Pending'))
  test('accepted', () => expect(reconfirmationStatusLabel('accepted')).toContain('Re-confirmed'))
  test('declined', () => expect(reconfirmationStatusLabel('declined')).toContain('Declined'))
  test('timed_out names days', () =>
    expect(reconfirmationStatusLabel('timed_out')).toContain(`${RECONFIRMATION_TIMEOUT_DAYS} days`))
  test('null → empty', () => expect(reconfirmationStatusLabel(null)).toBe(''))
})
describe('reconfirmationTimedOut', () => {
  const now = 100000
  test('true after 14 days', () => {
    expect(reconfirmationTimedOut(now - 15 * 24 * 60 * 60 * 1000, now)).toBe(true)
  })
  test('false within 14 days', () => {
    expect(reconfirmationTimedOut(now - 5 * 24 * 60 * 60 * 1000, now)).toBe(false)
  })
})
describe('shouldUnlistDuringReconfirmation', () => {
  test('true when pending', () => expect(shouldUnlistDuringReconfirmation('pending')).toBe(true))
  test('false when accepted', () =>
    expect(shouldUnlistDuringReconfirmation('accepted')).toBe(false))
})
describe('reconfirmationMessage', () => {
  test('names testimonial title', () => {
    expect(reconfirmationMessage('TOEFL Complete')).toContain('TOEFL Complete')
    expect(reconfirmationMessage('TOEFL Complete')).toContain('confirm')
  })
})
describe('optOutLabel', () => {
  test('student', () => expect(optOutLabel('student')).toContain('student'))
  test('staff', () => expect(optOutLabel('staff')).toContain('staff'))
  test('system', () => expect(optOutLabel('system')).toContain('inactivity'))
})
describe('shouldUnlistOptedOut', () => {
  test('true when optedOutAt set', () => expect(shouldUnlistOptedOut(1000)).toBe(true))
  test('false when null', () => expect(shouldUnlistOptedOut(null)).toBe(false))
})
