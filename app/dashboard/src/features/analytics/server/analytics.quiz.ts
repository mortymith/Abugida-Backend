import { createServerFn } from '@tanstack/react-start'
import { analyticsRangeSchema, quizAnalyticsParamsSchema } from '../schemas/analytics.schema'
import type { QuizAnalytics } from '../analytics.types'

/** S-5.2 Quiz Analytics for one quiz lesson. */
export const getQuizAnalytics = createServerFn({ method: 'GET' })
  .validator(async (input: unknown) => {
    return quizAnalyticsParamsSchema.and(analyticsRangeSchema).parse(input)
  })
  .handler(async ({ data }): Promise<QuizAnalytics> => {
    const { loadQuizAnalytics } = await import('./analytics.quiz.impl.server')
    return loadQuizAnalytics(data.courseId, data.lessonId, data)
  })
