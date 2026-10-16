import { describe, expect, test } from 'bun:test'
import {
  generateNgrams,
  highlightMatches,
  matchesQuery,
  segmentSyllables,
} from '#/features/courses/courses.geez-search'

describe('segmentSyllables', () => {
  test('Ethiopic word segments per glyph', () => {
    expect(segmentSyllables('እንግሊዝ')).toEqual(['እ', 'ን', 'ግ', 'ሊ', 'ዝ'])
  })
  test('whitespace dropped', () => {
    expect(segmentSyllables('እን ኛ')).toEqual(['እ', 'ን', 'ኛ'])
  })
  test('empty string', () => {
    expect(segmentSyllables('')).toEqual([])
  })
})
describe('generateNgrams', () => {
  test('5 syllables → 4 bigrams', () => {
    expect(generateNgrams(['እ', 'ን', 'ግ', 'ሊ', 'ዝ'])).toEqual(['እን', 'ንግ', 'ግሊ', 'ሊዝ'])
  })
  test('1 syllable → itself', () => {
    expect(generateNgrams(['እ'])).toEqual(['እ'])
  })
  test('empty → empty', () => {
    expect(generateNgrams([])).toEqual([])
  })
})
describe('matchesQuery — the spec example', () => {
  test('እንግሊዝ matches እንግሊዝኛ', () => {
    expect(matchesQuery('እንግሊዝኛ', 'እንግሊዝ')).toBe(true)
  })
  test('እንግሊዝ does NOT match ትግርኛ', () => {
    expect(matchesQuery('ትግርኛ', 'እንግሊዝ')).toBe(false)
  })
  test('partial query matches', () => {
    expect(matchesQuery('እንግሊዝኛ', 'እን')).toBe(true)
  })
  test('Latin: TOEFL matches TOEFL Prep', () => {
    expect(matchesQuery('TOEFL Prep', 'TOEFL')).toBe(true)
  })
  test('Latin: TOEFL does not match IELTS', () => {
    expect(matchesQuery('IELTS Prep', 'TOEFL')).toBe(false)
  })
  test('empty query matches everything', () => {
    expect(matchesQuery('anything', '')).toBe(true)
  })
})
describe('highlightMatches', () => {
  test('returns single non-highlighted segment for empty query', () => {
    const segments = highlightMatches('እንግሊዝ', '')
    expect(segments).toHaveLength(1)
    expect(segments[0].highlighted).toBe(false)
  })
  test('highlights matching syllables', () => {
    const segments = highlightMatches('እንግሊዝኛ', 'እን')
    const highlighted = segments.filter((s) => s.highlighted)
    expect(highlighted.length).toBeGreaterThan(0)
  })
})
