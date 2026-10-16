import { describe, expect, test } from 'bun:test'
import {
  checkFolderBoundary,
  classifyMediaKind,
  PREVIEW_KEYBOARD_SHORTCUTS,
  routeEscKey,
  shortcutApplies,
  unsupportedFormatReason,
} from '#/features/media/media.preview-modal-logic'

describe('classifyMediaKind', () => {
  test('video/mp4 → video', () => {
    expect(classifyMediaKind('video/mp4', null)).toBe('video')
  })
  test('image/png → image', () => {
    expect(classifyMediaKind('image/png', null)).toBe('image')
  })
  test('application/pdf → pdf', () => {
    expect(classifyMediaKind('application/pdf', null)).toBe('pdf')
  })
  test('audio/mpeg → audio', () => {
    expect(classifyMediaKind('audio/mpeg', null)).toBe('audio')
  })
  test('application/vnd.openxmlformats → unsupported', () => {
    expect(
      classifyMediaKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        null,
      ),
    ).toBe('unsupported')
  })
  test('infers from extension when MIME is null', () => {
    expect(classifyMediaKind(null, 'video.mp4')).toBe('video')
    expect(classifyMediaKind(null, 'doc.pdf')).toBe('pdf')
    expect(classifyMediaKind(null, 'photo.jpg')).toBe('image')
  })
  test('unsupported for unknown extension', () => {
    expect(classifyMediaKind(null, 'file.docx')).toBe('unsupported')
  })
})

describe('unsupportedFormatReason', () => {
  test('names the extension', () => {
    expect(unsupportedFormatReason('file.docx', null)).toBe(".docx files can't be previewed here.")
  })
  test('names the MIME type when no extension', () => {
    expect(unsupportedFormatReason(null, 'application/x-unknown')).toBe(
      "application/x-unknown files can't be previewed here.",
    )
  })
  test('generic message when neither', () => {
    expect(unsupportedFormatReason(null, null)).toBe("This file type can't be previewed here.")
  })
})

describe('checkFolderBoundary', () => {
  test('next at last asset is disabled with reason', () => {
    const result = checkFolderBoundary('next', 4, 5, 'TOEFL Speaking')
    expect(result.canNavigate).toBe(false)
    expect(result.reason).toBe('Last asset in TOEFL Speaking.')
  })
  test('prev at first asset is disabled with reason', () => {
    const result = checkFolderBoundary('prev', 0, 5, 'TOEFL Speaking')
    expect(result.canNavigate).toBe(false)
    expect(result.reason).toBe('First asset in TOEFL Speaking.')
  })
  test('next in the middle is permitted', () => {
    const result = checkFolderBoundary('next', 2, 5, 'TOEFL Speaking')
    expect(result.canNavigate).toBe(true)
    expect(result.reason).toBeNull()
  })
  test('prev in the middle is permitted', () => {
    const result = checkFolderBoundary('prev', 2, 5, 'TOEFL Speaking')
    expect(result.canNavigate).toBe(true)
    expect(result.reason).toBeNull()
  })
})

describe('routeEscKey', () => {
  test('modal_chrome closes the modal', () => {
    const result = routeEscKey('modal_chrome')
    expect(result.close).toBe('modal')
    expect(result.preventModalClose).toBe(false)
  })
  test('text_input does not close the modal', () => {
    const result = routeEscKey('text_input')
    expect(result.preventModalClose).toBe(true)
  })
  test('dropdown does not close the modal', () => {
    const result = routeEscKey('dropdown')
    expect(result.preventModalClose).toBe(true)
  })
  test('transcript_panel closes panel first, not modal', () => {
    const result = routeEscKey('transcript_panel')
    expect(result.close).toBe('panel')
    expect(result.preventModalClose).toBe(true)
  })
})

describe('shortcutApplies', () => {
  test('false when focus is in an input', () => {
    expect(shortcutApplies('video', true)).toBe(false)
  })
  test('false for unsupported media kind', () => {
    expect(shortcutApplies('unsupported', false)).toBe(false)
  })
  test('true for video when not in input', () => {
    expect(shortcutApplies('video', false)).toBe(true)
  })
})

describe('PREVIEW_KEYBOARD_SHORTCUTS', () => {
  test('video has Space/K, arrows, M, F, C', () => {
    const videoKeys = PREVIEW_KEYBOARD_SHORTCUTS.video.map((s) => s.keys)
    expect(videoKeys).toContain('Space / K')
    expect(videoKeys).toContain('C')
  })
  test('pdf has PageUp/PageDown and zoom', () => {
    const pdfKeys = PREVIEW_KEYBOARD_SHORTCUTS.pdf.map((s) => s.keys)
    expect(pdfKeys.some((k) => k.includes('PageUp'))).toBe(true)
    expect(pdfKeys.some((k) => k.includes('Ctrl/⌘ +'))).toBe(true)
  })
  test('unsupported has no shortcuts', () => {
    expect(PREVIEW_KEYBOARD_SHORTCUTS.unsupported).toHaveLength(0)
  })
})
