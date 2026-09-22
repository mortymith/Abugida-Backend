import { createServerFn } from '@tanstack/react-start'
import { studentIdSchema } from '../schemas/students.schema'

/** Client-safe S-4.2 Student Profile server functions. */

export const getStudentProfile = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getStudentProfileImpl } = await import('./students.profile.impl.server')
    return getStudentProfileImpl(data.studentId)
  })

export const getStudentCourses = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getStudentCoursesImpl } = await import('./students.profile.impl.server')
    return getStudentCoursesImpl(data.studentId)
  })

export const getStudentActivity = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getStudentActivityImpl } = await import('./students.profile.impl.server')
    return getStudentActivityImpl(data.studentId)
  })

export const getStudentThreads = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getStudentThreadsImpl } = await import('./students.messaging.impl.server')
    return getStudentThreadsImpl(data.studentId)
  })
