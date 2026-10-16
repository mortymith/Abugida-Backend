import { describe, expect, test } from 'bun:test'
import {
  classifyScript,
  computeReadTimeSeconds,
  formatReadTime,
  formatDateInCalendar,
  formatTimeEAT,
  typographyForLanguage,
} from '#/features/courses/courses.localization'

describe('classifyScript', () => {
  test('am → ethiopic', () => expect(classifyScript('am')).toBe('ethiopic'))
  test('en → latin', () => expect(classifyScript('en')).toBe('latin'))
  test('am-ET → ethiopic', () => expect(classifyScript('am-ET')).toBe('ethiopic'))
})
describe('computeReadTimeSeconds', () => {
  test('English 220 wpm', () => {
    expect(computeReadTimeSeconds(220, 'en')).toBe(60)
    expect(computeReadTimeSeconds(440, 'en')).toBe(120)
  })
  test('Amharic 180 wpm (denser)', () => {
    expect(computeReadTimeSeconds(180, 'am')).toBe(60)
    expect(computeReadTimeSeconds(360, 'am')).toBe(120)
  })
  test('Amharic takes longer than English for same words', () => {
    expect(computeReadTimeSeconds(220, 'am')).toBeGreaterThan(computeReadTimeSeconds(220, 'en'))
  })
  test('0 words → 0s', () => expect(computeReadTimeSeconds(0, 'en')).toBe(0))
})
describe('formatReadTime', () => {
  test('formats minutes', () => expect(formatReadTime(120)).toBe('2m'))
  test('formats hours + minutes', () => expect(formatReadTime(3900)).toContain('h'))
})
describe('formatDateInCalendar', () => {
  test('gregorian renders month name', () => {
    const date = new Date('2026-01-15T00:00:00Z')
    expect(formatDateInCalendar(date, 'gregorian')).toContain('Jan')
  })
  test('ethiopian renders Ethiopian month', () => {
    const date = new Date('2026-01-15T00:00:00Z')
    const result = formatDateInCalendar(date, 'ethiopian')
    expect(result).toBeTruthy()
  })
})
describe('formatTimeEAT', () => {
  test('includes EAT suffix', () => {
    const date = new Date('2026-01-15T15:00:00Z')
    expect(formatTimeEAT(date)).toContain('EAT')
  })
})
describe('typographyForLanguage', () => {
  test('Amharic → Noto Sans Ethiopic + line-height 1.6', () => {
    const typo = typographyForLanguage('am')
    expect(typo.fontFamily).toContain('Noto Sans Ethiopic')
    expect(typo.lineHeight).toBe(1.6)
  })
  test('English → Inter + line-height 1.5', () => {
    const typo = typographyForLanguage('en')
    expect(typo.fontFamily).toContain('Inter')
    expect(typo.lineHeight).toBe(1.5)
  })
})
