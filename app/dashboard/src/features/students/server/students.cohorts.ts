import { createServerFn } from '@tanstack/react-start'
import {
  cohortCreateSchema,
  cohortMembersUpdateSchema,
  cohortPublicIdSchema,
  cohortUpdateWithIdSchema,
  cohortsQuerySchema,
  studentIdSchema,
} from '../schemas/students.schema'

/** Client-safe S-4.4 Cohort Management server functions. */

export const getCohorts = createServerFn({ method: 'GET' })
  .validator((input: unknown) => cohortsQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getCohortsImpl } = await import('./students.cohorts.impl.server')
    return getCohortsImpl(data)
  })

export const getCohortMembers = createServerFn({ method: 'GET' })
  .validator((input: unknown) => cohortPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getCohortMembersImpl } = await import('./students.cohorts.impl.server')
    return getCohortMembersImpl(data)
  })

export const createCohort = createServerFn({ method: 'POST' })
  .validator((input: unknown) => cohortCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { createCohortImpl } = await import('./students.cohorts.impl.server')
    return createCohortImpl(data)
  })

export const updateCohort = createServerFn({ method: 'POST' })
  .validator((input: unknown) => cohortUpdateWithIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateCohortImpl } = await import('./students.cohorts.impl.server')
    return updateCohortImpl(data)
  })

export const deleteCohort = createServerFn({ method: 'POST' })
  .validator((input: unknown) => cohortPublicIdSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteCohortImpl } = await import('./students.cohorts.impl.server')
    return deleteCohortImpl(data)
  })

export const updateCohortMembers = createServerFn({ method: 'POST' })
  .validator((input: unknown) => cohortMembersUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateCohortMembersImpl } = await import('./students.cohorts.impl.server')
    return updateCohortMembersImpl(data)
  })

export const listCohortCandidateStudents = createServerFn({ method: 'GET' })
  .validator((input: unknown) => (typeof input === 'string' ? { q: input } : (input ?? {})))
  .handler(async ({ data }) => {
    const { listCohortCandidateStudentsImpl } = await import('./students.cohorts.impl.server')
    return listCohortCandidateStudentsImpl((data as { q?: string }).q)
  })

export const cohortIdsForStudent = createServerFn({ method: 'GET' })
  .validator((input: unknown) => studentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { cohortIdsForStudentImpl } = await import('./students.cohorts.impl.server')
    return cohortIdsForStudentImpl(data.studentId)
  })
