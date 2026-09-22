import { createServerFn } from '@tanstack/react-start'
import { studentIdSchema } from '../schemas/students.schema'

/** Client-safe S-4.3 Student Progress Dashboard server functions. */

export const getStudentProgress = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getStudentProgressImpl } = await import('./students.progress.impl.server')
    return getStudentProgressImpl(data.studentId)
  })
