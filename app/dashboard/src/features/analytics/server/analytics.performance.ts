import { createServerFn } from '@tanstack/react-start'
import { analyticsRangeSchema } from '../schemas/analytics.schema'
import type { CoursePerformanceAnalytics } from '../analytics.types'

/**
 * S-5.1 Course Performance analytics. Implementation lives in the server-only
 * impl module, dynamically imported inside the handler.
 */
export const getCoursePerformanceAnalytics = createServerFn({ method: 'GET' })
  .validator(async (input: unknown) => {
    const { z } = await import('zod')
    const schema = z.object({ courseId: z.string().uuid() }).and(analyticsRangeSchema)
    return schema.parse(input)
  })
  .handler(async ({ data }): Promise<CoursePerformanceAnalytics> => {
    const { loadCoursePerformanceAnalytics } = await import('./analytics.performance.impl.server')
    return loadCoursePerformanceAnalytics(data.courseId, data)
  })
