import { createServerFn } from '@tanstack/react-start'
import type { StudentDirectoryStats, StudentsReference } from '../students.types'
import {
  createStudentSchema,
  directoryQuerySchema,
  studentStatusSchema,
  updateStudentSchema,
  unenrollSchema,
  bulkEnrollSchema,
  addTagSchema,
  removeTagSchema,
} from '../schemas/students.schema'

/**
 * Client-safe S-4.1 directory server functions. Validators parse on both
 * sides; impls are dynamically imported so server-only code never enters
 * the client bundle.
 */

export const getDirectoryPage = createServerFn({ method: 'GET' })
  .validator((input: unknown) => directoryQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getDirectoryPageImpl } = await import('./students.directory.impl.server')
    return getDirectoryPageImpl(data)
  })

export const getDirectoryStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StudentDirectoryStats> => {
    const { getDirectoryStatsImpl } = await import('./students.directory.impl.server')
    return getDirectoryStatsImpl()
  },
)

export const createStudent = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createStudentSchema.parse(input))
  .handler(async ({ data }) => {
    const { createStudentImpl } = await import('./students.directory.impl.server')
    return createStudentImpl(data)
  })

export const updateStudent = createServerFn({ method: 'POST' })
  .validator((input: unknown) => updateStudentSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateStudentImpl } = await import('./students.directory.impl.server')
    return updateStudentImpl(data)
  })

export const setStudentStatus = createServerFn({ method: 'POST' })
  .validator((input: unknown) => studentStatusSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { setStudentStatusImpl } = await import('./students.directory.impl.server')
    return setStudentStatusImpl(data)
  })

export const enrollStudents = createServerFn({ method: 'POST' })
  .validator((input: unknown) => bulkEnrollSchema.parse(input))
  .handler(async ({ data }) => {
    const { enrollStudentsImpl } = await import('./students.directory.impl.server')
    return enrollStudentsImpl(data)
  })

export const unenrollStudent = createServerFn({ method: 'POST' })
  .validator((input: unknown) => unenrollSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { unenrollStudentImpl } = await import('./students.directory.impl.server')
    return unenrollStudentImpl(data)
  })

export const listEnrollableCourses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StudentsReference['courses']> => {
    const { listEnrollableCoursesImpl } = await import('./students.directory.impl.server')
    return listEnrollableCoursesImpl()
  },
)

export const addStudentTag = createServerFn({ method: 'POST' })
  .validator((input: unknown) => addTagSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { addStudentTagImpl } = await import('./students.directory.impl.server')
    return addStudentTagImpl(data)
  })

export const removeStudentTag = createServerFn({ method: 'POST' })
  .validator((input: unknown) => removeTagSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { removeStudentTagImpl } = await import('./students.directory.impl.server')
    return removeStudentTagImpl(data)
  })

export const getStudentsReference = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Omit<StudentsReference, 'courses'>> => {
    const { getStudentsReferenceImpl } = await import('./students.directory.impl.server')
    return getStudentsReferenceImpl()
  },
)
