/**
 * Markdown body validation — spec 12 § 9.2 / § 9.3.
 *
 * The `bodyFormat: z.literal('markdown')` on the save input is the boundary
 * enforcement for decision D-3: a client that forgets to call `getMarkdown()`
 * fails loudly here instead of writing HTML into a Markdown column.
 */
import { z } from 'zod'
import { auditMarkdown, LESSON_MIN_TEXT_LENGTH, summarizeMarkdown } from '../courses.markdown'
import type { MarkdownIssue } from '../courses.markdown'

/** Matches the 200k cap already enforced by `saveLessonSchema`. */
export const LESSON_MARKDOWN_MAX_LENGTH = 200_000

/**
 * Normalize a `lessons.bodyFormat` value read from the database.
 *
 * The column is `NOT NULL DEFAULT 'html'`, so the Drizzle type says it cannot
 * be null. This helper still guards, because a database can legitimately be one
 * migration behind the schema (a row written before the column existed), and a
 * lesson must never be misread as Markdown when it is actually HTML. Taking a
 * nullable parameter keeps the guard visible to the type system.
 */
export function readBodyFormat(value: string | null | undefined): 'html' | 'markdown' {
  return value === 'markdown' ? 'markdown' : 'html'
}

export const lessonMarkdownSchema = z.object({
  body: z.string().max(LESSON_MARKDOWN_MAX_LENGTH).nullable(),
  bodyFormat: z.literal('markdown'),
  /** Prose length, so the S-2.7 50-char rule measures text and not markup. */
  textLength: z.number().int().min(0),
})

export type LessonMarkdownInput = z.infer<typeof lessonMarkdownSchema>

export interface MarkdownValidation {
  ok: boolean
  /** Blocks saving entirely (S-2.7 "Content: Required"). */
  errors: string[]
  /** Non-blocking: content the editor would drop, or unstable serialization. */
  issues: MarkdownIssue[]
  summary: ReturnType<typeof summarizeMarkdown>
}

/**
 * Server-side lint. Runs on every save, including lessons hydrated from legacy
 * HTML, so a body is never silently rewritten into a lossy shape.
 */
export function validateLessonMarkdown(markdown: string | null): MarkdownValidation {
  const body = markdown ?? ''
  const issues = auditMarkdown(body)
  const summary = summarizeMarkdown(body)
  const errors: string[] = []

  if (body.trim() === '') {
    errors.push('Lesson content is required.')
  } else if (summary.textLength < LESSON_MIN_TEXT_LENGTH) {
    errors.push(
      `Lesson content must be at least ${LESSON_MIN_TEXT_LENGTH} characters. Currently ${summary.textLength}.`,
    )
  }

  if (body.length > LESSON_MARKDOWN_MAX_LENGTH) {
    errors.push(
      `Lesson content must be at most ${LESSON_MARKDOWN_MAX_LENGTH} characters. Currently ${body.length}.`,
    )
  }

  return { ok: errors.length === 0, errors, issues, summary }
}
