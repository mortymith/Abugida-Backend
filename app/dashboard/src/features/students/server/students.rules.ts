import { createServerFn } from '@tanstack/react-start'
import type { EnrollmentRuleRow } from '../students.types'
import {
  ruleDryRunSchema,
  ruleRunSchema,
  ruleRunsQuerySchema,
  ruleSaveSchema,
  ruleStatusChangeSchema,
} from '../schemas/students.schema'

/** Client-safe S-4.8 Automated Enrollment Rules server functions. */

export const getRules = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ items: EnrollmentRuleRow[] }> => {
    const { getRulesImpl } = await import('./students.rules.impl.server')
    return getRulesImpl()
  },
)

export const saveRule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ruleSaveSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveRuleImpl } = await import('./students.rules.impl.server')
    return saveRuleImpl(data)
  })

export const setRuleStatus = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ruleStatusChangeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { setRuleStatusImpl } = await import('./students.rules.impl.server')
    return setRuleStatusImpl(data)
  })

export const deleteRule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ruleRunSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteRuleImpl } = await import('./students.rules.impl.server')
    return deleteRuleImpl(data)
  })

export const duplicateRule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ruleRunSchema.parse(input))
  .handler(async ({ data }) => {
    const { duplicateRuleImpl } = await import('./students.rules.impl.server')
    return duplicateRuleImpl(data)
  })

export const dryRunRule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ruleDryRunSchema.parse(input))
  .handler(async ({ data }) => {
    const { dryRunRuleImpl } = await import('./students.rules.impl.server')
    return dryRunRuleImpl(data)
  })

export const runRule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ruleRunSchema.parse(input))
  .handler(async ({ data }) => {
    const { runRuleImpl } = await import('./students.rules.impl.server')
    return runRuleImpl(data)
  })

export const getRuleRuns = createServerFn({ method: 'GET' })
  .validator((input: unknown) => ruleRunsQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getRuleRunsImpl } = await import('./students.rules.impl.server')
    return getRuleRunsImpl(data)
  })
