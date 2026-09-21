import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { CourseAnalyticsDTO, CourseStudentsResult } from '../courses.types'

const studentsQuerySchema = z.object({
  coursePublicId: z.string().uuid(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(0).default(0),
})

export const getCourseStudents = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentsQuerySchema.parse(input))
  .handler(async ({ data }): Promise<CourseStudentsResult> => {
    const { getCourseStudentsImpl } = await import('./courses.students.impl.server')
    return getCourseStudentsImpl(data)
  })

/** Light per-course analytics for the S-2.6 Analytics tab (S-5.1 is spec 07). */
export const getCourseAnalytics = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ coursePublicId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<CourseAnalyticsDTO> => {
    const { getCourseAnalyticsImpl } = await import('./courses.students.impl.server')
    return getCourseAnalyticsImpl(data.coursePublicId)
  })
