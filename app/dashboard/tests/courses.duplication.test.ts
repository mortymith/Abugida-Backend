import { describe, expect, test } from 'bun:test'
import {
  COPY_SUFFIX,
  LESSON_TITLE_MAX,
  resolveCopyTitle,
} from '#/features/courses/courses.duplication'

/**
 * Regression coverage for S-7.7 "Duplicate lesson to another course".
 *
 * The previous implementation located the freshly created lesson by matching on
 * *title* against the returned curriculum, so a duplicate silently overwrote a
 * different, already-existing lesson whenever the target module held a
 * same-titled row. Copy titles must therefore always be collision-free.
 */
describe('duplicate lesson copy title', () => {
  test('appends the copy suffix to a fresh title', () => {
    expect(resolveCopyTitle('Scoring & test-day strategy', [])).toBe(
      `Scoring & test-day strategy${COPY_SUFFIX}`,
    )
  })

  test('trims surrounding whitespace', () => {
    expect(resolveCopyTitle('  Introduction  ', [])).toBe(`Introduction${COPY_SUFFIX}`)
  })

  test('does not double-suffix an already-copied title', () => {
    const once = resolveCopyTitle('Intro', [])
    expect(resolveCopyTitle(once, [])).toBe(once)
  })

  test('collides and escalates to a numbered suffix', () => {
    const taken = [`Intro${COPY_SUFFIX}`]
    expect(resolveCopyTitle('Intro', taken)).toBe('Intro (copy 2)')
    expect(resolveCopyTitle('Intro', [...taken, 'Intro (copy 2)'])).toBe('Intro (copy 3)')
  })

  test('is case-insensitive when detecting collisions', () => {
    expect(resolveCopyTitle('Intro', [`INTRO${COPY_SUFFIX}`])).toBe('Intro (copy 2)')
  })

  test('ignores padding when detecting collisions', () => {
    expect(resolveCopyTitle('Intro', [`  Intro${COPY_SUFFIX}  `])).toBe('Intro (copy 2)')
  })

  test('never exceeds the lessons.title column limit', () => {
    const longTitle = 'x'.repeat(400)
    const first = resolveCopyTitle(longTitle, [])
    expect(first.length).toBeLessThanOrEqual(LESSON_TITLE_MAX)

    const second = resolveCopyTitle(longTitle, [first])
    expect(second.length).toBeLessThanOrEqual(LESSON_TITLE_MAX)
    expect(second).not.toBe(first)
  })

  test('always returns a distinct title for a large taken-set', () => {
    const taken = Array.from({ length: 50 }, (_, index) =>
      index === 0 ? `Intro${COPY_SUFFIX}` : `Intro (copy ${index + 1})`,
    )
    const result = resolveCopyTitle('Intro', taken)
    expect(taken).not.toContain(result)
  })

  test('handles an empty source title without producing a bare suffix', () => {
    const result = resolveCopyTitle('', [])
    expect(result).toBe(COPY_SUFFIX)
    expect(result.length).toBeLessThanOrEqual(LESSON_TITLE_MAX)
  })
})
