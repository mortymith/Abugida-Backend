import { describe, expect, test } from 'bun:test'
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  formatBytes,
  isAcceptedSize,
  isAcceptedType,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAttachments,
} from '#/features/students/students.messaging-attachments'

describe('constants', () => {
  test('5 attachments max', () => {
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(5)
  })
  test('10 MB max size', () => {
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(10 * 1024 * 1024)
  })
  test('5 accepted extensions', () => {
    expect(ACCEPTED_ATTACHMENT_EXTENSIONS).toEqual(['.pdf', '.png', '.jpg', '.mp3', '.mp4'])
  })
})

describe('isAcceptedType', () => {
  test('accepts .pdf by extension', () => {
    expect(isAcceptedType('doc.pdf', null)).toBe(true)
  })
  test('accepts .png by extension', () => {
    expect(isAcceptedType('image.png', null)).toBe(true)
  })
  test('rejects .zip', () => {
    expect(isAcceptedType('archive.zip', null)).toBe(false)
  })
  test('rejects .docx', () => {
    expect(isAcceptedType('doc.docx', null)).toBe(false)
  })
  test('accepts by MIME type when no extension match', () => {
    expect(isAcceptedType('file', 'application/pdf')).toBe(true)
  })
})

describe('isAcceptedSize', () => {
  test('true for 5 MB', () => {
    expect(isAcceptedSize(5 * 1024 * 1024)).toBe(true)
  })
  test('false for 0 (empty)', () => {
    expect(isAcceptedSize(0)).toBe(false)
  })
  test('false for > 10 MB', () => {
    expect(isAcceptedSize(11 * 1024 * 1024)).toBe(false)
  })
})

describe('formatBytes', () => {
  test('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })
  test('formats KB', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
  test('formats MB', () => {
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB')
  })
})

describe('validateAttachments', () => {
  test('accepts valid files', () => {
    const result = validateAttachments([
      { name: 'doc.pdf', size: 5 * 1024 * 1024, type: 'application/pdf' },
      { name: 'image.png', size: 1 * 1024 * 1024, type: 'image/png' },
    ])
    expect(result.accepted).toBe(true)
    expect(result.rejections).toHaveLength(0)
  })

  test('rejects too many files', () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      name: `file${i}.pdf`,
      size: 1000,
      type: 'application/pdf',
    }))
    const result = validateAttachments(files)
    expect(result.accepted).toBe(false)
    expect(result.rejections.some((r) => r.reason === 'too_many_files')).toBe(true)
  })

  test('rejects oversized file with size in message', () => {
    const result = validateAttachments([
      { name: 'big.mp4', size: 24 * 1024 * 1024, type: 'video/mp4' },
    ])
    expect(result.accepted).toBe(false)
    expect(result.rejections[0].reason).toBe('file_too_large')
    expect(result.rejections[0].message).toContain('24.0 MB')
    expect(result.rejections[0].message).toContain('10.0 MB')
  })

  test('rejects unsupported type with accepted list in message', () => {
    const result = validateAttachments([{ name: 'archive.zip', size: 1000, type: null }])
    expect(result.accepted).toBe(false)
    expect(result.rejections[0].reason).toBe('unsupported_type')
    expect(result.rejections[0].message).toContain('PDF, PNG, JPG, MP3, MP4')
  })

  test('rejects empty file', () => {
    const result = validateAttachments([{ name: 'empty.pdf', size: 0, type: 'application/pdf' }])
    expect(result.accepted).toBe(false)
    expect(result.rejections[0].reason).toBe('empty_file')
  })

  test('mixed: one accepted, one rejected', () => {
    const result = validateAttachments([
      { name: 'doc.pdf', size: 1000, type: 'application/pdf' },
      { name: 'bad.zip', size: 1000, type: null },
    ])
    expect(result.accepted).toBe(false)
    expect(result.rejections).toHaveLength(1)
    expect(result.rejections[0].fileName).toBe('bad.zip')
  })
})
