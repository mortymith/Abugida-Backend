import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AnalyticsDropOffView, dropOffAnalyticsQueryOptions } from '#/features/analytics'

const dropOffSearchSchema = z.object({
  preset: z.enum(['7d', '30d', '90d', '12mo']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const Route = createFileRoute('/_app/analytics/courses/$courseId/drop-off')({
  validateSearch: dropOffSearchSchema,
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
  }),
  loader: ({ context, params, deps }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        dropOffAnalyticsQueryOptions(params.courseId, {
          preset: deps.preset,
          from: deps.from,
          to: deps.to,
        }),
      ),
    ]),
  component: DropOffAnalysisPage,
})

/** S-5.3 Drop-off Analysis — funnel of student disengagement per module. */
function DropOffAnalysisPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { courseId } = Route.useParams()
  const search = Route.useSearch()
  const range = { preset: search.preset, from: search.from, to: search.to }

  return (
    <AnalyticsDropOffView
      courseId={courseId}
      range={range}
      onRangeChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  )
}
