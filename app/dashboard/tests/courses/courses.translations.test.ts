import { describe, expect, test } from 'bun:test'
import {
  canAddVariant,
  CONTENT_LANGUAGE_LABELS,
  coveragePercentage,
  coverageSummaryLabel,
  isCoverageComplete,
  resolveBaseLanguage,
  SUPPORTED_CONTENT_LANGUAGES,
  untranslatedLanguages,
} from '#/features/courses/courses.translations'
import type { TranslationsModel } from '#/features/courses/courses.translations'

function model(
  baseLanguage: 'en' | 'am' | 'ti' | 'gez',
  variants: TranslationsModel['variants'],
): TranslationsModel {
  return { baseLanguage, variants }
}

describe('SUPPORTED_CONTENT_LANGUAGES', () => {
  test('four languages: en, am, ti, gez', () => {
    expect(SUPPORTED_CONTENT_LANGUAGES).toEqual(['en', 'am', 'ti', 'gez'])
  })

  test('every language has a label', () => {
    for (const lang of SUPPORTED_CONTENT_LANGUAGES) {
      expect(CONTENT_LANGUAGE_LABELS[lang]).toBeTruthy()
    }
  })
})

describe('untranslatedLanguages', () => {
  test('base language is never untranslated', () => {
    const m = model('en', [])
    const untranslated = untranslatedLanguages(m)
    expect(untranslated.find((u) => u.language === 'en')).toBeUndefined()
  })

  test('all non-base languages are untranslated when no variants exist', () => {
    const m = model('en', [])
    const untranslated = untranslatedLanguages(m)
    expect(untranslated.map((u) => u.language)).toEqual(['am', 'ti', 'gez'])
  })

  test('languages with variants are not untranslated', () => {
    const m = model('en', [
      { language: 'am', title: 'Amharic title', updatedAt: 0, updatedBy: null },
    ])
    const untranslated = untranslatedLanguages(m)
    expect(untranslated.map((u) => u.language)).toEqual(['ti', 'gez'])
  })
})

describe('canAddVariant', () => {
  test('permitted for a non-base language with no existing variant', () => {
    const m = model('en', [])
    const result = canAddVariant(m, 'am')
    expect(result.permitted).toBe(true)
  })

  test('not permitted for the base language (redundant)', () => {
    const m = model('en', [])
    const result = canAddVariant(m, 'en')
    expect(result.permitted).toBe(false)
    expect(result.reason).toContain('base language')
  })

  test('not permitted when a variant already exists', () => {
    const m = model('en', [{ language: 'am', title: 'Existing', updatedAt: 0, updatedBy: null }])
    const result = canAddVariant(m, 'am')
    expect(result.permitted).toBe(false)
    expect(result.reason).toContain('already exists')
  })
})

describe('resolveBaseLanguage', () => {
  test('lesson language overrides course language', () => {
    expect(resolveBaseLanguage('am', 'en')).toBe('am')
  })

  test('null lesson language falls back to course language', () => {
    expect(resolveBaseLanguage(null, 'gez')).toBe('gez')
  })
})

describe('coverage', () => {
  test('incomplete when not all languages covered', () => {
    const m = model('en', [])
    expect(isCoverageComplete(m)).toBe(false)
  })

  test('complete when all languages covered', () => {
    const m = model('en', [
      { language: 'am', title: 'Am', updatedAt: 0, updatedBy: null },
      { language: 'ti', title: 'Ti', updatedAt: 0, updatedBy: null },
      { language: 'gez', title: 'Gez', updatedAt: 0, updatedBy: null },
    ])
    expect(isCoverageComplete(m)).toBe(true)
  })

  test('percentage: 25% when only base covered', () => {
    const m = model('en', [])
    expect(coveragePercentage(m)).toBe(25)
  })

  test('percentage: 100% when all covered', () => {
    const m = model('en', [
      { language: 'am', title: 'Am', updatedAt: 0, updatedBy: null },
      { language: 'ti', title: 'Ti', updatedAt: 0, updatedBy: null },
      { language: 'gez', title: 'Gez', updatedAt: 0, updatedBy: null },
    ])
    expect(coveragePercentage(m)).toBe(100)
  })

  test('summary label: "All 4 languages covered"', () => {
    const m = model('en', [
      { language: 'am', title: 'Am', updatedAt: 0, updatedBy: null },
      { language: 'ti', title: 'Ti', updatedAt: 0, updatedBy: null },
      { language: 'gez', title: 'Gez', updatedAt: 0, updatedBy: null },
    ])
    expect(coverageSummaryLabel(m)).toBe('All 4 languages covered')
  })

  test('summary label: "2 of 4 languages covered"', () => {
    const m = model('en', [{ language: 'am', title: 'Am', updatedAt: 0, updatedBy: null }])
    expect(coverageSummaryLabel(m)).toBe('2 of 4 languages covered')
  })
})
