import { createServerFn } from '@tanstack/react-start'
import { cohortComparisonSearchSchema } from '../schemas/analytics.schema'
import type { CohortComparison } from '../analytics.types'

/**
 * S-5.5 Cohort Comparison. `cohorts` is a comma-separated list of public IDs
 * (URL-shareable); empty defaults to the two most recent cohorts.
 */
export const getCohortComparison = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    const parsed = cohortComparisonSearchSchema.parse(input)
    const cohortIds = parsed.cohorts
      ? parsed.cohorts
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []
    return { cohortIds }
  })
  .handler(async ({ data }): Promise<CohortComparison> => {
    const { loadCohortComparison } = await import('./analytics.cohorts.impl.server')
    return loadCohortComparison(data.cohortIds)
  })
