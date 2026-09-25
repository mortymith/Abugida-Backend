import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

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
  contentType: z.enum(['pdf', 'video', 'quiz', 'exercise', 'link']),
  videoUrl: VIDEO_URL.nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
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
