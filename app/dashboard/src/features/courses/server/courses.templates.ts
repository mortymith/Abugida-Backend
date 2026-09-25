import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  saveAsTemplateSchema,
  templateQuerySchema,
  useTemplateSchema,
} from '../schemas/courses.workflow.schema'
import type { CourseTemplateDTO } from '../courses.types'

export const getCourseTemplates = createServerFn({ method: 'GET' })
  .validator((input: unknown) => templateQuerySchema.parse(input))
  .handler(async ({ data }): Promise<CourseTemplateDTO[]> => {
    const { getCourseTemplatesImpl } = await import('./courses.templates.impl.server')
    return getCourseTemplatesImpl(data)
  })

export const useTemplate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => useTemplateSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { useTemplateImpl } = await import('./courses.templates.impl.server')
    return useTemplateImpl(data.templatePublicId)
  })

/** Save an existing course's structure as a workspace template (S-2.6 menu). */
export const saveCourseAsTemplate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveAsTemplateSchema.parse(input))
  .handler(async ({ data }): Promise<{ templatePublicId: string }> => {
    const { saveCourseAsTemplateImpl } = await import('./courses.templates.impl.server')
    return saveCourseAsTemplateImpl(data)
  })

const templateStructureInput = z.object({ templatePublicId: z.string().uuid() })
void templateStructureInput
