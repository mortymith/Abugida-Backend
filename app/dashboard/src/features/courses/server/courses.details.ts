import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { courseDetailsDraftSchema, courseDetailsSchema } from '../schemas/courses.authoring.schema'
import type { CourseDetailsDTO } from '../courses.types'

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })

export const getCourseDetails = createServerFn({ method: 'GET' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<CourseDetailsDTO> => {
    const { getCourseDetailsImpl } = await import('./courses.details.impl.server')
    return getCourseDetailsImpl(data.coursePublicId)
  })

/** Create a blank draft (S-2.2 "Save as Draft" on a new course). */
export const createCourseDraft = createServerFn({ method: 'POST' })
  .validator((input: unknown) => courseDetailsDraftSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { createCourseDraftImpl } = await import('./courses.details.impl.server')
    return createCourseDraftImpl(data)
  })

/** Full-details save (wizard step 1 "Next", or Edit Details in S-2.6). */
export const saveCourseDetails = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    courseDetailsSchema.extend({ coursePublicId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { saveCourseDetailsImpl } = await import('./courses.details.impl.server')
    return saveCourseDetailsImpl(data)
  })
