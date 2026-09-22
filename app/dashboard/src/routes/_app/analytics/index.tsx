import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AnalyticsHubView } from '#/features/analytics'
import { coursePerformanceQueryOptions } from '#/features/dashboard/dashboard.queries'

const analyticsIndexSearchSchema = z.object({
  preset: z.enum(['7d', '30d', '90d', '12mo']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/_app/analytics/')({
  validateSearch: analyticsIndexSearchSchema,
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
    page: search.page ?? 1,
  }),
  loader: ({ context, deps }) =>
    // Warm the cache; failures surface through the component query.
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        coursePerformanceQueryOptions(
          { preset: deps.preset, from: deps.from, to: deps.to },
          deps.page,
        ),
      ),
    ]),
  component: AnalyticsHubPage,
})

/** Analytics hub: course performance list as the S-5.1 entry point. */
function AnalyticsHubPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const range = { preset: search.preset, from: search.from, to: search.to }
  const page = search.page ?? 1

  return (
    <AnalyticsHubView
      range={range}
      page={page}
      onRangeChange={(next) =>
        navigate({ search: (prev) => ({ ...prev, page: undefined, ...next }) })
      }
      onPageChange={(nextPage) =>
        navigate({ search: (prev) => ({ ...prev, page: nextPage === 1 ? undefined : nextPage }) })
      }
    />
  )
}
