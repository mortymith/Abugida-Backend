import { describe, expect, test } from 'bun:test'
import {
  buildSrtMetadata,
  buildVttHeader,
  classifyScript,
  computeReadTimeSeconds,
  ETHIOPIC_LANGUAGES,
  formatReadTime,
  generateLongLineWarnings,
  LATIN_WORDS_PER_MINUTE,
  ETHIOPIC_WORDS_PER_MINUTE,
  MAX_CHARS_PER_LINE_LATIN,
  typographyForLanguage,
} from '#/features/media/media.transcript-geez'

describe('classifyScript', () => {
  test('am → ethiopic', () => {
    expect(classifyScript('am')).toBe('ethiopic')
  })
  test('ti → ethiopic', () => {
    expect(classifyScript('ti')).toBe('ethiopic')
  })
  test('gez → ethiopic', () => {
    expect(classifyScript('gez')).toBe('ethiopic')
  })
  test('en → latin', () => {
    expect(classifyScript('en')).toBe('latin')
  })
  test('am-ET → ethiopic (BCP-47 subtag)', () => {
    expect(classifyScript('am-ET')).toBe('ethiopic')
  })
  test('en-US → latin', () => {
    expect(classifyScript('en-US')).toBe('latin')
  })
})

describe('ETHIOPIC_LANGUAGES', () => {
  test('includes am, ti, gez', () => {
    expect(ETHIOPIC_LANGUAGES.has('am')).toBe(true)
    expect(ETHIOPIC_LANGUAGES.has('ti')).toBe(true)
    expect(ETHIOPIC_LANGUAGES.has('gez')).toBe(true)
  })
})

describe('computeReadTimeSeconds (script-aware)', () => {
  test('English uses /220 (Latin constant)', () => {
    // 220 words → 60 s (1 minute)
    expect(computeReadTimeSeconds(220, 'en')).toBe(60)
    // 440 words → 120 s (2 minutes)
    expect(computeReadTimeSeconds(440, 'en')).toBe(120)
  })
  test('Amharic uses /180 (Ethiopic constant)', () => {
    // 180 words → 60 s (1 minute)
    expect(computeReadTimeSeconds(180, 'am')).toBe(60)
    // 360 words → 120 s (2 minutes)
    expect(computeReadTimeSeconds(360, 'am')).toBe(120)
  })
  test("Ge'ez is denser — same word count takes longer than English", () => {
    // 220 words: English = ceil(220/220)*60 = 60s; Amharic = ceil(220/180)*60 = 120s
    const words = 220
    const englishTime = computeReadTimeSeconds(words, 'en')
    const amharicTime = computeReadTimeSeconds(words, 'am')
    expect(amharicTime).toBeGreaterThan(englishTime)
    expect(englishTime).toBe(60)
    expect(amharicTime).toBe(120)
  })
  test('0 words → 0 s', () => {
    expect(computeReadTimeSeconds(0, 'en')).toBe(0)
  })
})

describe('formatReadTime', () => {
  test('formats minutes', () => {
    expect(formatReadTime(120)).toBe('2m')
  })
  test('formats hours + minutes', () => {
    expect(formatReadTime(3900)).toBe('1h 5m')
  })
  test('rounds up seconds to minutes', () => {
    expect(formatReadTime(61)).toBe('2m')
  })
})

describe('generateLongLineWarnings (42-char rule Latin-only)', () => {
  test('Latin: warns on > 42 chars per line', () => {
    const longLine = 'a'.repeat(50)
    const warning = generateLongLineWarnings('s1', longLine, 'en')
    expect(warning).not.toBeNull()
    expect(warning?.charCount).toBe(50)
    expect(warning?.blocks).toBe(false) // advisory, never blocks
  })
  test('Latin: no warning for short lines', () => {
    const warning = generateLongLineWarnings('s1', 'short line', 'en')
    expect(warning).toBeNull()
  })
  test('Ethiopic: no warning even for long lines (advisory only)', () => {
    const longAmharic = 'እንደምን'.repeat(20) // long Ethiopic text
    const warning = generateLongLineWarnings('s1', longAmharic, 'am')
    expect(warning).toBeNull()
  })
  test('Ethiopic: never blocks', () => {
    const warning = generateLongLineWarnings('s1', 'a'.repeat(100), 'gez')
    expect(warning).toBeNull()
  })
})

describe('buildVttHeader (lang= header)', () => {
  test('includes Language header', () => {
    const header = buildVttHeader('am')
    expect(header).toContain('WEBVTT')
    expect(header).toContain('Language: am')
  })
  test('includes region when provided', () => {
    const header = buildVttHeader('en', 'US')
    expect(header).toContain('Region: US')
  })
})

describe('buildSrtMetadata', () => {
  test('includes language as a NOTE comment', () => {
    const metadata = buildSrtMetadata('am')
    expect(metadata).toContain('NOTE')
    expect(metadata).toContain('Language: am')
  })
})

describe('typographyForLanguage', () => {
  test('Ethiopic returns Noto Sans Ethiopic stack with line-height 1.6', () => {
    const typo = typographyForLanguage('am')
    expect(typo.fontFamily).toContain('Noto Sans Ethiopic')
    expect(typo.lineHeight).toBe(1.6)
    expect(typo.noLineClamp).toBe(true)
  })
  test('Latin returns Inter stack with line-height 1.5', () => {
    const typo = typographyForLanguage('en')
    expect(typo.fontFamily).toContain('Inter')
    expect(typo.lineHeight).toBe(1.5)
  })
})

describe('constants', () => {
  test('Latin WPM is 220', () => {
    expect(LATIN_WORDS_PER_MINUTE).toBe(220)
  })
  test('Ethiopic WPM is 180', () => {
    expect(ETHIOPIC_WORDS_PER_MINUTE).toBe(180)
  })
  test('max chars per line is 42', () => {
    expect(MAX_CHARS_PER_LINE_LATIN).toBe(42)
  })
})
