import { createServerFn } from '@tanstack/react-start'
import type { CoursePerformancePage } from '../dashboard.types'

/**
 * Server function for the S-1.1 course performance table (server-side
 * pagination via URL search params). Implementation lives in the server-only
 * impl module, dynamically imported inside the handler.
 */
export const getCoursePerformance = createServerFn({ method: 'GET' })
  .validator(async (input: unknown) => {
    const { parseCoursePerformanceInput } =
      await import('./dashboard.course-performance.impl.server')
    return parseCoursePerformanceInput(input)
  })
  .handler(async ({ data }): Promise<CoursePerformancePage> => {
    const { loadCoursePerformance } = await import('./dashboard.course-performance.impl.server')
    return loadCoursePerformance(data)
  })
