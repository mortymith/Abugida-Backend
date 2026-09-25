import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { unlockRulesSaveSchema } from '../schemas/courses.learning.schema'
import type { UnlockRulesDTO } from '../courses.types'

const lessonInputSchema = z.object({ lessonPublicId: z.string().uuid() })

export const getUnlockRules = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }): Promise<UnlockRulesDTO> => {
    const { getUnlockRulesImpl } = await import('./courses.unlock-rules.impl.server')
    return getUnlockRulesImpl(data.lessonPublicId)
  })

/**
 * Save unlock rules (S-2.15). Returns { ok:false, cycle } instead of throwing
 * for circular dependencies so the UI can highlight the offending lessons.
 */
export const saveUnlockRules = createServerFn({ method: 'POST' })
  .validator((input: unknown) => unlockRulesSaveSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; rules: UnlockRulesDTO }
      | { ok: false; reason: 'cycle'; cycleLessonPublicIds: string[] }
    > => {
      const { saveUnlockRulesImpl } = await import('./courses.unlock-rules.impl.server')
      return saveUnlockRulesImpl(data)
    },
  )
