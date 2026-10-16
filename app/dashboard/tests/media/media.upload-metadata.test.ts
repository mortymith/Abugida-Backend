import { describe, expect, test } from 'bun:test'
import {
  buildInitialMetadata,
  defaultNameFromFile,
  detectNameCollision,
  normalizeTags,
  shouldShowReplaceCheckbox,
  suggestCollisionSuffix,
  validatePerFileMetadata,
} from '#/features/media/media.upload-metadata'

describe('defaultNameFromFile', () => {
  test('strips extension', () => {
    expect(defaultNameFromFile('Reading_Overview.mp4')).toBe('Reading_Overview')
  })
  test('strips .pdf', () => {
    expect(defaultNameFromFile('TOEFL_Syllabus.pdf')).toBe('TOEFL_Syllabus')
  })
  test('no extension keeps full name', () => {
    expect(defaultNameFromFile('README')).toBe('README')
  })
  test('leading dot (hidden file) keeps full name', () => {
    expect(defaultNameFromFile('.gitignore')).toBe('.gitignore')
  })
})

describe('suggestCollisionSuffix', () => {
  test('starts at (2)', () => {
    expect(suggestCollisionSuffix('Reading', new Set(['Reading']))).toBe(' (2)')
  })
  test('increments past existing (2)', () => {
    expect(suggestCollisionSuffix('Reading', new Set(['Reading', 'Reading (2)']))).toBe(' (3)')
  })
})

describe('detectNameCollision', () => {
  const existing = [
    { id: 'a1', name: 'Reading Overview' },
    { id: 'a2', name: 'TOEFL Syllabus' },
  ]

  test('unique when no collision', () => {
    expect(detectNameCollision('New Asset', existing)).toEqual({ kind: 'unique' })
  })

  test('collision detected (case-insensitive)', () => {
    const result = detectNameCollision('reading overview', existing)
    expect(result.kind).toBe('collision')
    if (result.kind === 'collision') {
      expect(result.existingAssetId).toBe('a1')
      expect(result.suggestedSuffix).toBe(' (2)')
    }
  })

  test('collision includes suggested suffix', () => {
    const result = detectNameCollision('TOEFL Syllabus', existing)
    if (result.kind === 'collision') {
      expect(result.suggestedSuffix).toBe(' (2)')
    }
  })
})

describe('shouldShowReplaceCheckbox', () => {
  test('false when unique', () => {
    expect(shouldShowReplaceCheckbox({ kind: 'unique' })).toBe(false)
  })
  test('true when collision', () => {
    const collision = {
      kind: 'collision' as const,
      existingAssetId: 'a1',
      existingAssetName: 'Reading',
      suggestedSuffix: ' (2)',
    }
    expect(shouldShowReplaceCheckbox(collision)).toBe(true)
  })
})

describe('validatePerFileMetadata', () => {
  test('valid metadata returns null', () => {
    const result = validatePerFileMetadata({
      fileId: 'f1',
      fileName: 'test.mp4',
      displayName: 'Test Asset',
      tags: ['TOEFL'],
      description: '',
      folderId: null,
    })
    expect(result).toBeNull()
  })

  test('empty name returns error', () => {
    const result = validatePerFileMetadata({
      fileId: 'f1',
      fileName: 'test.mp4',
      displayName: '',
      tags: [],
      description: '',
      folderId: null,
    })
    expect(result?.displayName).toContain('required')
  })

  test('over 300 char name returns error', () => {
    const result = validatePerFileMetadata({
      fileId: 'f1',
      fileName: 'test.mp4',
      displayName: 'a'.repeat(301),
      tags: [],
      description: '',
      folderId: null,
    })
    expect(result?.displayName).toContain('300')
  })

  test('over 20 tags returns error', () => {
    const result = validatePerFileMetadata({
      fileId: 'f1',
      fileName: 'test.mp4',
      displayName: 'Test',
      tags: Array(21).fill('tag'),
      description: '',
      folderId: null,
    })
    expect(result?.tags).toContain('20')
  })
})

describe('normalizeTags', () => {
  test('trims and lowercases', () => {
    expect(normalizeTags(['  TOEFL  ', 'Reading'])).toEqual(['toefl', 'reading'])
  })
  test('deduplicates', () => {
    expect(normalizeTags(['TOEFL', 'toefl', 'Reading'])).toEqual(['toefl', 'reading'])
  })
  test('caps at 20', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`)
    expect(normalizeTags(tags).length).toBe(20)
  })
  test('drops empty tags', () => {
    expect(normalizeTags(['', '  ', 'TOEFL'])).toEqual(['toefl'])
  })
})

describe('buildInitialMetadata', () => {
  test('defaults displayName to filename sans extension', () => {
    const meta = buildInitialMetadata('f1', 'Reading_Overview.mp4', 'folder-1')
    expect(meta.displayName).toBe('Reading_Overview')
    expect(meta.tags).toEqual([])
    expect(meta.description).toBe('')
    expect(meta.folderId).toBe('folder-1')
  })
})
