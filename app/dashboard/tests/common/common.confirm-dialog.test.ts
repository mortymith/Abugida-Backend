import { describe, expect, test } from 'bun:test'
import {
  initialFocusLabel,
  isTypedConfirmationValid,
  shouldFocusReversible,
  typedMismatchMessage,
  unsavedChangesBody,
  unsavedChangesTitle,
} from '#/components/common/common.confirm-dialog'
import type {
  ConfirmDialogConfig,
  UnsavedChangesConfig,
} from '#/components/common/common.confirm-dialog'

const config: ConfirmDialogConfig = {
  title: 'Delete "TOEFL Complete" permanently?',
  body: 'This deletes the course and its 234 student enrollments.',
  consequenceCount: 234,
  confirmLabel: 'Delete permanently',
  tone: 'danger',
}

describe('isTypedConfirmationValid', () => {
  test('true when exact match', () =>
    expect(isTypedConfirmationValid('Delete permanently', 'Delete permanently')).toBe(true))
  test('false when mismatch', () =>
    expect(isTypedConfirmationValid('Wrong', 'Delete permanently')).toBe(false))
  test('trims whitespace', () =>
    expect(isTypedConfirmationValid('  Delete permanently  ', 'Delete permanently')).toBe(true))
})
describe('typedMismatchMessage', () => {
  test('names the required string', () => {
    expect(typedMismatchMessage('Delete permanently')).toContain(
      'Type Delete permanently to confirm',
    )
  })
})
describe('shouldFocusReversible', () => {
  test('true when reversibleAlternative present', () => {
    const c = { ...config, reversibleAlternative: { label: 'Archive instead' } }
    expect(shouldFocusReversible(c)).toBe(true)
  })
  test('false when no reversibleAlternative', () => {
    expect(shouldFocusReversible(config)).toBe(false)
  })
})
describe('initialFocusLabel', () => {
  test('reversible alternative label when present', () => {
    const c = { ...config, reversibleAlternative: { label: 'Archive instead' } }
    expect(initialFocusLabel(c)).toBe('Archive instead')
  })
  test('Cancel label when no reversible alternative', () => {
    expect(initialFocusLabel(config)).toBe('Cancel')
  })
})
describe('unsavedChangesTitle', () => {
  test('returns spec wording', () => expect(unsavedChangesTitle()).toBe('You have unsaved changes'))
})
describe('unsavedChangesBody', () => {
  test('names each dirty surface + measure', () => {
    const unsavedConfig: UnsavedChangesConfig = {
      surfaces: [
        { label: 'Lesson body', measure: '340 characters unsaved' },
        { label: 'Quiz', measure: '2 questions' },
      ],
      saveModel: 'explicit-save',
    }
    const body = unsavedChangesBody(unsavedConfig)
    expect(body).toContain('Lesson body — 340 characters unsaved')
    expect(body).toContain('Quiz — 2 questions')
  })
})
