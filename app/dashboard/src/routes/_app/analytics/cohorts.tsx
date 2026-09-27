import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AnalyticsCohortsView, cohortComparisonQueryOptions } from '#/features/analytics'

const cohortsSearchSchema = z.object({
  /** Comma-separated cohort public IDs; empty = two most recent (spec). */
  cohorts: z.string().optional(),
})

export const Route = createFileRoute('/_app/analytics/cohorts')({
  validateSearch: cohortsSearchSchema,
  loaderDeps: ({ search }) => ({ cohorts: search.cohorts }),
  loader: ({ context, deps }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        cohortComparisonQueryOptions(deps.cohorts ? deps.cohorts.split(',').filter(Boolean) : []),
      ),
    ]),
  component: CohortComparisonPage,
})

/** S-5.5 Cohort Comparison Report. */
function CohortComparisonPage() {
  const search = Route.useSearch()
  const cohortIds = search.cohorts ? search.cohorts.split(',').filter(Boolean) : []
  return <AnalyticsCohortsView cohortIds={cohortIds} />
}
