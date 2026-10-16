import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  isSearchableTerm,
  isSearchTermChange,
  normalizeSearchTerm,
} from '#/features/search/search.term'
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from '#/features/search/search.recent'

/**
 * The header search used to be a stub hook that debounced a keystroke into a
 * hard-coded empty list, so it never found anything. It now runs the same query
 * as the `/search` page, which means the term contract is shared by both:
 * normalised keys, a minimum length the server validator accepts, and recents
 * that are read from the browser only.
 */
describe('normalizeSearchTerm', () => {
  test('trims so a trailing space does not become a second cache entry', () => {
    expect(normalizeSearchTerm('  algebra ')).toBe('algebra')
  })

  test('caps the term at the server validator limit', () => {
    expect(normalizeSearchTerm('a'.repeat(SEARCH_MAX_LENGTH + 20))).toHaveLength(SEARCH_MAX_LENGTH)
  })

  test('maps blank, whitespace-only and missing input to an empty term', () => {
    expect(normalizeSearchTerm('')).toBe('')
    expect(normalizeSearchTerm('   ')).toBe('')
    expect(normalizeSearchTerm(undefined)).toBe('')
  })
})

describe('isSearchableTerm', () => {
  test('requires the server minimum length', () => {
    expect(isSearchableTerm('a')).toBe(false)
    expect(isSearchableTerm(' a ')).toBe(false)
    expect(isSearchableTerm('ab')).toBe(true)
  })

  test('mirrors SEARCH_MIN_LENGTH so the two cannot drift', () => {
    expect(isSearchableTerm('a'.repeat(SEARCH_MIN_LENGTH - 1))).toBe(false)
    expect(isSearchableTerm('a'.repeat(SEARCH_MIN_LENGTH))).toBe(true)
  })
})

describe('isSearchTermChange', () => {
  test('ignores input that normalises to the applied term', () => {
    expect(isSearchTermChange('algebra', 'algebra ')).toBe(false)
    expect(isSearchTermChange('algebra', `algebra${' '.repeat(5)}`)).toBe(false)
  })

  test('detects a real refinement', () => {
    expect(isSearchTermChange('algebra', 'geometry')).toBe(true)
    expect(isSearchTermChange('algebra', '')).toBe(true)
  })
})

describe('recent searches', () => {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }

  // The module guards on `window` so it stays importable during SSR; the fake
  // window exercises the browser path without a DOM.
  ;(globalThis as { window?: unknown }).window = { localStorage }

  // Storage is process-wide, so each test starts and ends from a known list.
  beforeEach(() => {
    clearRecentSearches()
  })
  afterEach(() => {
    clearRecentSearches()
  })

  test('keeps the newest term first and de-duplicates it', () => {
    rememberSearch('algebra')
    rememberSearch('geometry')
    rememberSearch('algebra')
    expect(readRecentSearches()).toEqual(['algebra', 'geometry'])
  })

  test('de-duplicates case-insensitively, keeping the newest spelling', () => {
    rememberSearch('Algebra')
    rememberSearch('algebra')
    expect(readRecentSearches()).toEqual(['algebra'])
  })

  test('normalises and caps stored terms', () => {
    rememberSearch('  spaced  ')
    rememberSearch('x'.repeat(SEARCH_MAX_LENGTH + 5))
    // Newest first, and the over-long term is already capped by normalisation.
    expect(readRecentSearches()).toEqual(['x'.repeat(SEARCH_MAX_LENGTH), 'spaced'])
  })

  test('ignores blank terms', () => {
    rememberSearch('   ')
    expect(readRecentSearches()).toEqual([])
  })

  test('survives corrupted storage instead of throwing', () => {
    store.set('abugida-recent-searches', '{not json')
    expect(readRecentSearches()).toEqual([])
    store.set('abugida-recent-searches', '{"a":1}')
    expect(readRecentSearches()).toEqual([])
  })

  test('clears both storage and the in-memory list', () => {
    rememberSearch('algebra')
    clearRecentSearches()
    expect(readRecentSearches()).toEqual([])
  })
})

describe('SEARCH_DEBOUNCE_MS', () => {
  test('is short enough to feel immediate', () => {
    expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(300)
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(150)
  })
})
