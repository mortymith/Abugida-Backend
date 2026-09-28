import { describe, expect, test } from 'bun:test'
import {
  LESSON_MARKDOWN_MAX_LENGTH,
  lessonMarkdownSchema,
  validateLessonMarkdown,
} from '#/features/courses/schemas/courses.markdown.schema'
import { LESSON_MIN_TEXT_LENGTH } from '#/features/courses/courses.markdown'

const LONG = 'TOEFL measures reading listening and speaking across four sections. '.repeat(3)

describe('lessonMarkdownSchema (spec 12 § 9.2)', () => {
  test('accepts a markdown body', () => {
    const result = lessonMarkdownSchema.safeParse({
      body: '# What is TOEFL?',
      bodyFormat: 'markdown',
      textLength: 15,
    })
    expect(result.success).toBe(true)
  })

  test('rejects anything but markdown (D-3 boundary enforcement)', () => {
    const result = lessonMarkdownSchema.safeParse({
      body: '<p>legacy html</p>',
      bodyFormat: 'html',
      textLength: 12,
    })
    expect(result.success).toBe(false)
  })

  test('rejects a missing bodyFormat', () => {
    const result = lessonMarkdownSchema.safeParse({ body: '# x', textLength: 1 })
    expect(result.success).toBe(false)
  })

  test('enforces the 200k cap', () => {
    const result = lessonMarkdownSchema.safeParse({
      body: 'a'.repeat(LESSON_MARKDOWN_MAX_LENGTH + 1),
      bodyFormat: 'markdown',
      textLength: 1,
    })
    expect(result.success).toBe(false)
  })

  test('accepts a null body', () => {
    const result = lessonMarkdownSchema.safeParse({
      body: null,
      bodyFormat: 'markdown',
      textLength: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('validateLessonMarkdown (spec 12 § 9.3)', () => {
  test('an empty body is required-error, not a crash', () => {
    const result = validateLessonMarkdown('')
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('required')
  })

  test('null is treated as empty', () => {
    expect(validateLessonMarkdown(null).ok).toBe(false)
  })

  test('measures the 50-character rule against prose, not markup', () => {
    // 60 characters of Markdown, but only 1 of prose.
    const result = validateLessonMarkdown('## ' + '#'.repeat(60))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('at least 50')
  })

  test('accepts a real lesson body', () => {
    const result = validateLessonMarkdown(LONG)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  test('reports the 200k cap with actual and limit', () => {
    const result = validateLessonMarkdown('a'.repeat(LESSON_MARKDOWN_MAX_LENGTH + 1))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain(String(LESSON_MARKDOWN_MAX_LENGTH))
  })

  test('surfaces loss issues without blocking the save', () => {
    // A hyperlinked image is a genuine loss: ProseMirror has no mark on an
    // image node, so the wrapping link is dropped while the image survives.
    const lossy = `${'word '.repeat(40)}[![alt](https://x.example/i.png)](https://y.example)`
    const result = validateLessonMarkdown(lossy)
    expect(result.summary.textLength).toBeGreaterThanOrEqual(LESSON_MIN_TEXT_LENGTH)
    expect(result.ok).toBe(true)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues[0]?.code).toBe('loses_content')
  })

  test('a clean body reports no issues', () => {
    const result = validateLessonMarkdown(
      `${LONG}\n\n- [x] a task\n\n| a | b |\n| --- | --- |\n| 1 | 2 |`,
    )
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  test('summarizes construct counts for the editor footer', () => {
    const result = validateLessonMarkdown('# Title\n\n- [x] one\n\n- [ ] two\n')
    expect(result.summary.headingCount).toBe(1)
    expect(result.summary.taskCount).toBe(2)
  })
})
