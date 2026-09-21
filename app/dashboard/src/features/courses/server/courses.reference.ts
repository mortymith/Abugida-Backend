import { createServerFn } from '@tanstack/react-start'
import type { CourseFormReference } from '../courses.types'

/**
 * S-2.2 form reference data: categories (exam types), instructors (users),
 * and configured payment gateways. Single round-trip for the wizard.
 */
export const getCourseFormReference = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CourseFormReference> => {
    const { loadCourseFormReference } = await import('./courses.reference.impl.server')
    return loadCourseFormReference()
  },
)
