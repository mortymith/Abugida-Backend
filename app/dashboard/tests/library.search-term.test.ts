import { describe, expect, test } from 'bun:test'
import {
  isLibrarySearchTermChange,
  LIBRARY_SEARCH_DEBOUNCE_MS,
  LIBRARY_SEARCH_MAX_LENGTH,
  normalizeLibrarySearchTerm,
} from '#/features/library/library.search-term'
import {
  LIBRARY_SEARCH_MAX_LENGTH as SCHEMA_MAX_LENGTH,
  parseLibrarySearch,
} from '#/features/library/schemas/library.schema'

/**
 * The Content Library search box (spec 05 S-3.1) used to be bound straight to
 * `?q=` and navigate on every keystroke, so characters typed faster than the
 * route loader committed were dropped and Back walked backwards one letter at
 * a time. The field now holds a local draft and commits a *normalised* term.
 * These cover the normalisation contract that makes that work.
 */
describe('normalizeLibrarySearchTerm', () => {
  test('trims the term so a trailing space is not a new query', () => {
    expect(normalizeLibrarySearchTerm('  lecture  ')).toBe('lecture')
  })

  test('maps blank and whitespace-only input to undefined (clears the filter)', () => {
    expect(normalizeLibrarySearchTerm('')).toBeUndefined()
    expect(normalizeLibrarySearchTerm('   ')).toBeUndefined()
    expect(normalizeLibrarySearchTerm(undefined)).toBeUndefined()
  })

  test('caps the term at the server-side limit', () => {
    const normalized = normalizeLibrarySearchTerm('x'.repeat(500))
    expect(normalized).toHaveLength(LIBRARY_SEARCH_MAX_LENGTH)
  })

  test('preserves inner spacing and case (search stays substring, case-insensitive)', () => {
    expect(normalizeLibrarySearchTerm('TOEFL  syllabus')).toBe('TOEFL  syllabus')
  })

  test('never throws on a non-string', () => {
    expect(() => normalizeLibrarySearchTerm(42 as unknown as string)).not.toThrow()
    expect(normalizeLibrarySearchTerm(42 as unknown as string)).toBeUndefined()
  })
})

describe('isLibrarySearchTermChange', () => {
  test('a first term is a change', () => {
    expect(isLibrarySearchTermChange(undefined, 'lecture')).toBe(true)
  })

  test('re-typing the applied term is not a change', () => {
    expect(isLibrarySearchTermChange('lecture', 'lecture')).toBe(false)
  })

  test('adding or removing a trailing space is not a change', () => {
    expect(isLibrarySearchTermChange('lecture', 'lecture ')).toBe(false)
    expect(isLibrarySearchTermChange('lecture ', 'lecture')).toBe(false)
  })

  test('clearing an applied term is a change', () => {
    expect(isLibrarySearchTermChange('lecture', '')).toBe(true)
    expect(isLibrarySearchTermChange('lecture', '   ')).toBe(true)
  })
})

describe('search term ↔ URL round trip', () => {
  test('the input and the Zod schema share one length cap', () => {
    expect(LIBRARY_SEARCH_MAX_LENGTH).toBe(SCHEMA_MAX_LENGTH)
  })

  test('a normalised term survives parseLibrarySearch unchanged', () => {
    const typed = '  TOEFL syllabus  '
    const parsed = parseLibrarySearch({ q: normalizeLibrarySearchTerm(typed) ?? '' })
    expect(parsed.q).toBe('TOEFL syllabus')
  })

  test('a whitespace-only URL param narrows to no search', () => {
    expect(parseLibrarySearch({ q: '   ' }).q).toBeUndefined()
  })

  test('the debounce is a sane non-zero interval', () => {
    expect(LIBRARY_SEARCH_DEBOUNCE_MS).toBeGreaterThan(0)
    expect(LIBRARY_SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(1_000)
  })
})
