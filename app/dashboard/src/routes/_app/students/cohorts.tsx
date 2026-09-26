import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { StudentsCohortsView } from '#/features/students'
import { cohortsQueryOptions } from '#/features/students/hooks/students.queries'

const cohortsSearchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_app/students/cohorts')({
  validateSearch: cohortsSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) =>
    Promise.allSettled([context.queryClient.ensureQueryData(cohortsQueryOptions({ q: deps.q }))]),
  component: StudentsCohortsPage,
})

/** S-4.4 Cohort Management. */
function StudentsCohortsPage() {
  const search = Route.useSearch()
  return <StudentsCohortsView query={search} />
}
