import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const duplicateLessonInput = z.object({
  lessonPublicId: z.string().uuid(),
  /** Target module; its course is resolved server-side and never trusted from the client. */
  targetModulePublicId: z.string().uuid(),
  includeContent: z.boolean().default(true),
  includeQuiz: z.boolean().default(true),
})

export type DuplicateLessonInput = z.infer<typeof duplicateLessonInput>

export type DuplicateLessonResult = {
  lessonPublicId: string
  coursePublicId: string
  copiedQuiz: boolean
}

/**
 * S-7.7 Duplicate lesson to another course.
 *
 * Runs as a single transaction: the lesson, its media/body fields and
 * (optionally) its quiz are copied atomically, so a failure can never leave a
 * half-initialised stub lesson behind.
 */
export const duplicateLesson = createServerFn({ method: 'POST' })
  .validator((input: unknown) => duplicateLessonInput.parse(input))
  .handler(async ({ data }): Promise<DuplicateLessonResult> => {
    const { duplicateLessonImpl } = await import('./courses.duplication.impl.server')
    return duplicateLessonImpl(data)
  })
