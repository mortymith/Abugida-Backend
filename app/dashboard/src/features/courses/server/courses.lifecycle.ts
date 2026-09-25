import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { coursePublishSchema } from '../schemas/courses.authoring.schema'

export const publishCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublishSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string; scheduled: boolean }> => {
    const { publishCourseImpl } = await import('./courses.lifecycle.impl.server')
    return publishCourseImpl(data)
  })

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })

export const archiveCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { archiveCourseImpl } = await import('./courses.lifecycle.impl.server')
    return archiveCourseImpl(data.coursePublicId)
  })

export const deleteCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteCourseImpl } = await import('./courses.lifecycle.impl.server')
    return deleteCourseImpl(data.coursePublicId)
  })

/** Deep copy: details + curriculum + pricing become a fresh draft (S-2.1/S-2.6 Duplicate). */
export const duplicateCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { duplicateCourseImpl } = await import('./courses.lifecycle.impl.server')
    return duplicateCourseImpl(data.coursePublicId)
  })
