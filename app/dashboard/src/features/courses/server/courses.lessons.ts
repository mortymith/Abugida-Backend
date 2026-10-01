import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { MarkdownValidation as LessonMarkdownValidation } from '../schemas/courses.markdown.schema'

const lessonInputSchema = z.object({ lessonPublicId: z.string().uuid() })

/** S-2.7 editor payload for one lesson (content + settings). */
export const getLessonForEdit = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { getLessonForEditImpl } = await import('./courses.lessons.impl.server')
    return getLessonForEditImpl(data.lessonPublicId)
  })

const VIDEO_URL = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value === '' ||
      /^(https?:\/\/)?(www\.)?(youtube\.com\/\S+|youtu\.be\/\S+|vimeo\.com\/\S+)/i.test(value),
    'Video URL must be a YouTube or Vimeo link',
  )

export const saveLessonSchema = z.object({
  lessonPublicId: z.string().uuid(),
  title: z.string().trim().min(3, 'At least 3 characters').max(300),
  body: z.string().max(200_000).nullable(),
  /**
   * Decision D-3 (spec 12 § 5.4): the client must state the serialization
   * format it produced. Accepting only 'markdown' means a client that forgets
   * to call `getMarkdown()` fails loudly here instead of silently writing HTML
   * into a column that is supposed to hold Markdown.
   */
  bodyFormat: z.literal('markdown'),
  contentType: z.enum(['pdf', 'video', 'quiz', 'exercise', 'link']),
  videoUrl: VIDEO_URL.nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  /** Media provenance (spec 05): null clears any linked asset. */
  assetId: z.string().uuid().nullable().optional(),
  /** Optimistic concurrency: reject stale saves (concurrent edits). */
  expectedRowVersion: z.number().int().positive(),
})

export type SaveLessonInput = z.infer<typeof saveLessonSchema>

export const saveLesson = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveLessonSchema.parse(input))
  .handler(async ({ data }): Promise<{ rowVersion: number }> => {
    const { saveLessonImpl } = await import('./courses.lessons.impl.server')
    return saveLessonImpl(data)
  })

/** Submit for review / re-submit (S-2.7 ↔ S-2.14). */
export const submitLessonForReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { submitForReviewImpl } = await import('./courses.reviews.impl.server')
    return submitForReviewImpl({ lessonPublicId: data.lessonPublicId })
  })

/**
 * Server-side Markdown lint (spec 12 § 9.3).
 *
 * `MarkdownManager` is DOM-free, so this is a real server-side check rather than
 * a client-only courtesy. Runs on every save — including lessons hydrated from
 * legacy HTML — so a body is never silently rewritten into a lossy shape.
 */
export const validateLessonMarkdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ markdown: z.string().max(200_000) }).parse(input))
  .handler(async ({ data }): Promise<LessonMarkdownValidation> => {
    const { validateLessonMarkdownImpl } = await import('./courses.markdown-validate.impl.server')
    return validateLessonMarkdownImpl(data.markdown)
  })

/** Raw Markdown export for one lesson (Copy / Download). */
export const exportLessonMarkdown = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ markdown: string; bodyFormat: string }> => {
    const { exportLessonMarkdownImpl } = await import('./courses.markdown-validate.impl.server')
    return exportLessonMarkdownImpl(data.lessonPublicId)
  })

/**
 * Convert one lesson's body from legacy HTML to Markdown (spec 12 § 5.3).
 *
 * Idempotent: a row already marked 'markdown' is a no-op, so the migration is
 * safe to re-run. A row whose HTML contains markup outside the legacy schema is
 * reported as unconvertible and left as HTML rather than being guessed at.
 */
export const migrateLessonBodyToMarkdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { migrateLessonBodyImpl } = await import('./courses.markdown-validate.impl.server')
    return migrateLessonBodyImpl(data.lessonPublicId)
  })
