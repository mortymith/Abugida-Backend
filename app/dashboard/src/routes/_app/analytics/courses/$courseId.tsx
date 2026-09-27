import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AnalyticsPerformanceView, performanceAnalyticsQueryOptions } from '#/features/analytics'

const coursePerformanceSearchSchema = z.object({
  preset: z.enum(['7d', '30d', '90d', '12mo']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const Route = createFileRoute('/_app/analytics/courses/$courseId')({
  validateSearch: coursePerformanceSearchSchema,
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
  }),
  loader: ({ context, params, deps }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        performanceAnalyticsQueryOptions(params.courseId, {
          preset: deps.preset,
          from: deps.from,
          to: deps.to,
        }),
      ),
    ]),
  component: CoursePerformanceAnalyticsPage,
})

/** S-5.1 Course Performance — detailed analytics for one course. */
function CoursePerformanceAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { courseId } = Route.useParams()
  const search = Route.useSearch()
  const range = { preset: search.preset, from: search.from, to: search.to }

  return (
    <AnalyticsPerformanceView
      courseId={courseId}
      range={range}
      onRangeChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  )
}
