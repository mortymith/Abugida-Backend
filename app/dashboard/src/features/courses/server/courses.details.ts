import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { courseDetailsDraftSchema, courseDetailsSchema } from '../schemas/courses.authoring.schema'
import type { CourseDetailsDTO } from '../courses.types'

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })

/**
 * S-2.6 inline title save.
 *
 * Separate from `saveCourseDetails` because the identity header commits **one
 * field** on blur/Enter, and the full-details schema demands a description,
 * exam type and instructor the header has no business collecting. A narrower
 * server function is also what lets the server enforce the Field Lock table
 * itself: the UI disables the control for an Approved course, and the server
 * refuses the write, so a client that skips the UI still cannot corrupt a
 * review.
 *
 * The slug is **not** regenerated here. Spec 04: "regenerated only while the
 * course is a Draft" — a rename on a live course must not break inbound links.
 */
const courseTitleSchema = z.object({
  coursePublicId: z.string().uuid(),
  title: z.string().trim().min(3).max(300),
})

export const saveCourseTitle = createServerFn({ method: 'POST' })
  .validator((input: unknown) => courseTitleSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string; slugRegenerated: boolean }> => {
    const { saveCourseTitleImpl } = await import('./courses.details.impl.server')
    return saveCourseTitleImpl(data)
  })

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
