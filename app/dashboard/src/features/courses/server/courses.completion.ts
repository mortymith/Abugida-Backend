import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { completionRulesSaveSchema } from '../schemas/courses.learning.schema'
import type { CompletionSettingsDTO } from '../courses.types'

const courseInputSchema = z.object({ coursePublicId: z.string().uuid() })

export const getCompletionSettings = createServerFn({ method: 'GET' })
  .validator((input: unknown) => courseInputSchema.parse(input))
  .handler(async ({ data }): Promise<CompletionSettingsDTO> => {
    const { getCompletionSettingsImpl } = await import('./courses.completion.impl.server')
    return getCompletionSettingsImpl(data.coursePublicId)
  })

export const saveCompletionSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) => completionRulesSaveSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { saveCompletionSettingsImpl } = await import('./courses.completion.impl.server')
    return saveCompletionSettingsImpl(data)
  })
