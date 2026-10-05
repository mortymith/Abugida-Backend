import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AnalyticsPerformanceView, performanceAnalyticsQueryOptions } from '#/features/analytics'
import { DATE_RANGE_PRESETS } from '#/features/dashboard/schemas/dashboard.date-range.schema'

const coursePerformanceSearchSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
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
