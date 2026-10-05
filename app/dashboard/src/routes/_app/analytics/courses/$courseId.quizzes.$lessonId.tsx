import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AnalyticsQuizView, quizAnalyticsQueryOptions } from '#/features/analytics'
import { DATE_RANGE_PRESETS } from '#/features/dashboard/schemas/dashboard.date-range.schema'

const quizSearchSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const Route = createFileRoute('/_app/analytics/courses/$courseId/quizzes/$lessonId')({
  validateSearch: quizSearchSchema,
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
  }),
  loader: ({ context, params, deps }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        quizAnalyticsQueryOptions(params.courseId, params.lessonId, {
          preset: deps.preset,
          from: deps.from,
          to: deps.to,
        }),
      ),
    ]),
  component: QuizAnalyticsPage,
})

/** S-5.2 Quiz Analytics — per-question performance for one quiz. */
function QuizAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { courseId, lessonId } = Route.useParams()
  const search = Route.useSearch()
  const range = { preset: search.preset, from: search.from, to: search.to }

  return (
    <AnalyticsQuizView
      courseId={courseId}
      lessonId={lessonId}
      range={range}
      onRangeChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  )
}
