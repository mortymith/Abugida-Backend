import { describe, expect, test } from 'bun:test'
import {
  buildContentPayload,
  duplicateLessonTitle,
  resolveDuplicateOrder,
  DUPLICATE_STARTS_DRAFT_NOTE,
} from '#/features/courses/courses.duplicate-lesson'

/** S-7.7 Duplicate Lesson decision rules (spec 09). */

describe('duplicateLessonTitle', () => {
  test('appends the " (copy)" suffix', () => {
    expect(duplicateLessonTitle('Skimming Basics')).toBe('Skimming Basics (copy)')
  })

  test('shows the conflict suffix before confirming, spec wording', () => {
    const existing = ['Skimming Basics (copy)']
    expect(duplicateLessonTitle('Skimming Basics', existing)).toBe('Skimming Basics (copy) 2')
  })

  test('numbering increments deterministically for repeated conflicts', () => {
    const existing = ['Skimming Basics (copy)', 'Skimming Basics (copy) 2']
    expect(duplicateLessonTitle('Skimming Basics', existing)).toBe('Skimming Basics (copy) 3')
  })

  test('a title already ending in (copy) is kept as-is when free', () => {
    expect(duplicateLessonTitle('Skimming Basics (copy)')).toBe('Skimming Basics (copy)')
  })
})

describe('resolveDuplicateOrder', () => {
  const order = ['a', 'b', 'c', 'd']

  test('end mode keeps the created lesson last', () => {
    expect(resolveDuplicateOrder(order, 'e', 'end', null)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  test('after mode inserts directly after the chosen lesson', () => {
    expect(resolveDuplicateOrder(order, 'e', 'after', 'b')).toEqual(['a', 'b', 'e', 'c', 'd'])
  })

  test('falls back to the end when the anchor lesson is unknown', () => {
    expect(resolveDuplicateOrder(order, 'e', 'after', 'zzz')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  test('is idempotent about the created lesson', () => {
    expect(resolveDuplicateOrder(['a', 'e'], 'e', 'after', 'a')).toEqual(['a', 'e'])
  })
})

describe('buildContentPayload', () => {
  const source = {
    body: '<p>Skim the passage first.</p>',
    contentType: 'video' as const,
    videoUrl: 'https://youtube.com/watch?v=abc',
    durationMinutes: 12,
    assetId: '0f0e0d0c-0b0a-4098-8070-605040302010',
    tags: ['reading'],
  }

  test('copies content with the shared asset reference (never re-uploads)', () => {
    const payload = buildContentPayload({ content: true, quiz: true }, source)
    expect(payload).toEqual(source)
  })

  test('returns null when content is excluded', () => {
    expect(buildContentPayload({ content: false, quiz: true }, source)).toBeNull()
  })

  test('returns null without a source lesson', () => {
    expect(buildContentPayload({ content: true, quiz: false }, null)).toBeNull()
  })
})

describe('draft guarantee', () => {
  test('the modal copy never promises a publish bypass', () => {
    expect(DUPLICATE_STARTS_DRAFT_NOTE).toContain('Draft')
    expect(DUPLICATE_STARTS_DRAFT_NOTE).toContain('Unlock rules are never copied')
  })
})
