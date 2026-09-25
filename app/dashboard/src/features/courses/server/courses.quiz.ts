import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { quizSaveSchema } from '../schemas/courses.learning.schema'
import type { QuizDTO } from '../courses.types'

const lessonInput = z.object({ lessonPublicId: z.string().uuid() })

export const getQuizForLesson = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInput.parse(input))
  .handler(async ({ data }): Promise<QuizDTO> => {
    const { getQuizForLessonImpl } = await import('./courses.quiz.impl.server')
    return getQuizForLessonImpl(data.lessonPublicId)
  })

/**
 * Full quiz save (S-2.8). Removed questions are soft-deleted so historical
 * quiz attempts keep their referential integrity; the save is blocked when
 * any question violates the exactly-one-correct rule.
 */
export const saveQuiz = createServerFn({ method: 'POST' })
  .validator((input: unknown) => quizSaveSchema.parse(input))
  .handler(async ({ data }): Promise<QuizDTO> => {
    const { saveQuizImpl } = await import('./courses.quiz.impl.server')
    return saveQuizImpl(data)
  })
