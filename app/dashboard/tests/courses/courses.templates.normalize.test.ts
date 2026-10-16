import { describe, expect, test } from 'bun:test'
import { TEMPLATE_CONTENT_TYPES } from '#/features/courses/courses.types'
import {
  LEGACY_CONTENT_TYPE_ALIASES,
  normalizeTemplateContentType,
  normalizeTemplateStructure,
} from '#/features/courses/courses.templates.normalize'

/**
 * Regression coverage for the Template Library "Use" failure:
 * templates seeded with `contentType: 'reading'` aborted the whole import with
 * `invalid input value for enum content_type: "reading"`, because 'reading' is
 * not a member of the enum.
 */
describe('template content type normalization', () => {
  test('every canonical content type survives untouched', () => {
    for (const value of TEMPLATE_CONTENT_TYPES) {
      expect(normalizeTemplateContentType(value)).toBe(value)
    }
  })

  test("maps the legacy 'reading' value onto a valid enum member", () => {
    expect(normalizeTemplateContentType('reading')).toBe('pdf')
  })

  test('is case and whitespace insensitive', () => {
    expect(normalizeTemplateContentType('  Reading ')).toBe('pdf')
    expect(normalizeTemplateContentType('VIDEO')).toBe('video')
  })

  test('every legacy alias resolves to a canonical content type', () => {
    const canonical = new Set<string>(TEMPLATE_CONTENT_TYPES)
    for (const target of Object.values(LEGACY_CONTENT_TYPE_ALIASES)) {
      expect(canonical.has(target)).toBe(true)
    }
  })

  test('falls back to video for unknown and non-string values', () => {
    expect(normalizeTemplateContentType('bogus')).toBe('video')
    expect(normalizeTemplateContentType(undefined)).toBe('video')
    expect(normalizeTemplateContentType(null)).toBe('video')
    expect(normalizeTemplateContentType(42)).toBe('video')
  })

  test('produces only enum-valid content types for a realistic seeded template', () => {
    const raw = {
      modules: [
        {
          title: 'TOEFL Foundations',
          description: 'Test format.',
          lessons: [
            { title: 'What is the TOEFL?', contentType: 'video', durationMinutes: 20 },
            { title: 'Scoring & test-day strategy', contentType: 'reading', durationMinutes: 25 },
            { title: 'Foundations check', contentType: 'quiz', durationMinutes: 15 },
          ],
        },
      ],
    }

    const normalized = normalizeTemplateStructure(raw)
    const types: string[] = normalized.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.contentType),
    )

    expect(types).toEqual(['video', 'pdf', 'quiz'])
    for (const type of types) {
      expect(TEMPLATE_CONTENT_TYPES as readonly string[]).toContain(type)
    }
  })

  test('preserves non-contentType lesson and module fields', () => {
    const normalized = normalizeTemplateStructure({
      modules: [
        {
          title: 'M1',
          description: 'D1',
          lessons: [
            {
              title: 'L1',
              contentType: 'reading',
              body: 'Body text',
              videoUrl: 'https://example.com/v',
              durationMinutes: 25,
            },
          ],
        },
      ],
    })

    const [module] = normalized.modules
    const [lesson] = module.lessons
    expect(lesson.title).toBe('L1')
    expect(lesson.body).toBe('Body text')
    expect(lesson.videoUrl).toBe('https://example.com/v')
    expect(lesson.durationMinutes).toBe(25)
    expect(lesson.contentType).toBe('pdf')
    expect(module.title).toBe('M1')
  })

  test('tolerates malformed payloads instead of throwing', () => {
    expect(normalizeTemplateStructure(null)).toEqual({ modules: [] })
    expect(normalizeTemplateStructure(undefined)).toEqual({ modules: [] })
    expect(normalizeTemplateStructure('nope')).toEqual({ modules: [] })
    expect(normalizeTemplateStructure({})).toEqual({ modules: [] })
    expect(normalizeTemplateStructure({ modules: 'nope' })).toEqual({ modules: [] })
    const [module] = normalizeTemplateStructure({ modules: [{ title: 'M' }] }).modules
    expect(module.title).toBe('M')
    expect(module.lessons).toEqual([])
  })
})
