import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { curriculumSaveSchema } from '../schemas/courses.authoring.schema'
import type { CurriculumDTO } from '../courses.types'

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })
const moduleCreateInput = coursePublicIdInput.extend({
  title: z.string().trim().min(3).max(300),
})
const moduleMutationInput = z.object({ modulePublicId: z.string().uuid() })
const lessonCreateInput = moduleMutationInput.extend({
  title: z.string().trim().min(3).max(300),
})
const lessonMutationInput = z.object({ lessonPublicId: z.string().uuid() })

export const getCurriculum = createServerFn({ method: 'GET' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { getCurriculumImpl } = await import('./courses.curriculum.impl.server')
    return getCurriculumImpl(data.coursePublicId)
  })

export const createModule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => moduleCreateInput.parse(input))
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { createModuleImpl } = await import('./courses.curriculum.impl.server')
    return createModuleImpl(data)
  })

export const renameModule = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    moduleMutationInput.extend({ title: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { renameModuleImpl } = await import('./courses.curriculum.impl.server')
    return renameModuleImpl(data)
  })

export const deleteModule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => moduleMutationInput.parse(input))
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { deleteModuleImpl } = await import('./courses.curriculum.impl.server')
    return deleteModuleImpl(data)
  })

export const createLesson = createServerFn({ method: 'POST' })
  .validator((input: unknown) => lessonCreateInput.parse(input))
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { createLessonImpl } = await import('./courses.curriculum.impl.server')
    return createLessonImpl(data)
  })

export const renameLesson = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    lessonMutationInput.extend({ title: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { renameLessonImpl } = await import('./courses.curriculum.impl.server')
    return renameLessonImpl(data)
  })

export const deleteLesson = createServerFn({ method: 'POST' })
  .validator((input: unknown) => lessonMutationInput.parse(input))
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { deleteLessonImpl } = await import('./courses.curriculum.impl.server')
    return deleteLessonImpl(data)
  })

/** Full-tree save: titles + ordering across modules (drag-and-drop). */
export const saveCurriculumOrder = createServerFn({ method: 'POST' })
  .validator((input: unknown) => curriculumSaveSchema.parse(input))
  .handler(async ({ data }): Promise<CurriculumDTO> => {
    const { saveCurriculumOrderImpl } = await import('./courses.curriculum.impl.server')
    return saveCurriculumOrderImpl(data)
  })
