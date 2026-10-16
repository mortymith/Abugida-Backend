import { describe, expect, test } from 'bun:test'
import {
  generateNgrams,
  highlightMatches,
  matchesQuery,
  segmentSyllables,
  tokenizeForIndex,
  tokenizeQuery,
} from '#/features/courses/courses.geez-search'

describe('segmentSyllables', () => {
  test('Ethiopic word segments into one syllable per glyph', () => {
    // እንግሊዝ = 5 Ethiopic syllables
    expect(segmentSyllables('እንግሊዝ')).toEqual(['እ', 'ን', 'ግ', 'ሊ', 'ዝ'])
  })

  test('Latin word segments per-character', () => {
    expect(segmentSyllables('TOEFL')).toEqual(['T', 'O', 'E', 'F', 'L'])
  })

  test('whitespace is dropped', () => {
    expect(segmentSyllables('እንግሊዝ ኛ')).toEqual(['እ', 'ን', 'ግ', 'ሊ', 'ዝ', 'ኛ'])
  })

  test('mixed Ethiopic and Latin segments correctly', () => {
    expect(segmentSyllables('እን TOEFL')).toEqual(['እ', 'ን', 'T', 'O', 'E', 'F', 'L'])
  })

  test('empty string produces no syllables', () => {
    expect(segmentSyllables('')).toEqual([])
  })

  test('whitespace-only string produces no syllables', () => {
    expect(segmentSyllables('   \n\t  ')).toEqual([])
  })
})

describe('generateNgrams', () => {
  test('5 syllables produce 4 bigrams', () => {
    const ngrams = generateNgrams(['እ', 'ን', 'ግ', 'ሊ', 'ዝ'])
    expect(ngrams).toEqual(['እን', 'ንግ', 'ግሊ', 'ሊዝ'])
  })

  test('single syllable produces itself', () => {
    expect(generateNgrams(['እ'])).toEqual(['እ'])
  })

  test('empty produces empty', () => {
    expect(generateNgrams([])).toEqual([])
  })

  test('two syllables produce one bigram', () => {
    expect(generateNgrams(['እ', 'ን'])).toEqual(['እን'])
  })
})

describe('tokenizeForIndex', () => {
  test('produces a deduplicated set including single syllables and bigrams', () => {
    // አበበ = አ, በ, በ → single syllables {አ, በ} + bigrams {አበ, በበ} = 4 tokens
    const tokens = tokenizeForIndex('አበበ')
    expect(tokens.size).toBe(4)
    expect(tokens.has('አ')).toBe(true)
    expect(tokens.has('በ')).toBe(true)
    expect(tokens.has('አበ')).toBe(true)
    expect(tokens.has('በበ')).toBe(true)
  })
})

describe('tokenizeQuery', () => {
  test('returns null for empty query (no filter)', () => {
    expect(tokenizeQuery('')).toBeNull()
  })

  test('returns null for whitespace-only query', () => {
    expect(tokenizeQuery('   ')).toBeNull()
  })

  test('returns n-grams for Ethiopic query', () => {
    const ngrams = tokenizeQuery('እንግሊዝ')
    expect(ngrams).toEqual(['እን', 'ንግ', 'ግሊ', 'ሊዝ'])
  })
})

describe('matchesQuery — the spec example', () => {
  // spec: query እንግሊዝ ("English") should match row title እንግሊዝኛ ("English-language")
  test('እንግሊዝ matches እንግሊዝኛ', () => {
    expect(matchesQuery('እንግሊዝኛ', 'እንግሊዝ')).toBe(true)
  })

  test('እንግሊዝ does NOT match ትግርኛ (different syllables)', () => {
    expect(matchesQuery('ትግርኛ', 'እንግሊዝ')).toBe(false)
  })

  test('partial query matches (prefix semantics via n-grams)', () => {
    // query እን (2 syllables → 1 bigram) matches any title containing እን
    expect(matchesQuery('እንግሊዝኛ', 'እን')).toBe(true)
    expect(matchesQuery('እንግሊዝ', 'እን')).toBe(true)
    expect(matchesQuery('ትግርኛ', 'እን')).toBe(false)
  })

  test('Latin query matches Latin title (TOEFL query matches TOEFL row)', () => {
    expect(matchesQuery('TOEFL Prep', 'TOEFL')).toBe(true)
    expect(matchesQuery('IELTS Prep', 'TOEFL')).toBe(false)
  })

  test('empty query matches everything (no filter)', () => {
    expect(matchesQuery('እንግሊዝ', '')).toBe(true)
    expect(matchesQuery('TOEFL', '')).toBe(true)
  })

  test('single-syllable query matches titles containing that syllable', () => {
    expect(matchesQuery('እንግሊዝ', 'እ')).toBe(true)
  })
})

describe('highlightMatches', () => {
  test('returns the full title as a single non-highlighted segment for empty query', () => {
    const segments = highlightMatches('እንግሊዝ', '')
    expect(segments).toHaveLength(1)
    expect(segments[0].highlighted).toBe(false)
    expect(segments[0].text).toBe('እንግሊዝ')
  })

  test('highlights the matching syllable group', () => {
    // query እን should highlight the እን portion of እንግሊዝኛ
    const segments = highlightMatches('እንግሊዝኛ', 'እን')
    const highlighted = segments.filter((s) => s.highlighted)
    expect(highlighted.length).toBeGreaterThan(0)
    expect(highlighted.some((s) => s.text.includes('እ'))).toBe(true)
  })

  test('preserves whitespace in output', () => {
    const segments = highlightMatches('እንግሊዝ ኛ', 'እን')
    const fullText = segments.map((s) => s.text).join('')
    expect(fullText).toBe('እንግሊዝ ኛ')
  })

  test('non-matching title produces all non-highlighted segments', () => {
    const segments = highlightMatches('ትግርኛ', 'እን')
    expect(segments.every((s) => !s.highlighted)).toBe(true)
  })
})
