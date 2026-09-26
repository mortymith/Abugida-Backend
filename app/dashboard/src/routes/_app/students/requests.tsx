import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { StudentsRequestsView } from '#/features/students'
import {
  enrollmentRequestsQueryOptions,
  waitlistOverviewQueryOptions,
} from '#/features/students/hooks/students.queries'

const requestsSearchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_app/students/requests')({
  validateSearch: requestsSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(enrollmentRequestsQueryOptions({ q: deps.q })),
      context.queryClient.ensureQueryData(waitlistOverviewQueryOptions()),
    ]),
  component: StudentsRequestsPage,
})

/** S-4.6 Enrollment Requests / Waitlist. */
function StudentsRequestsPage() {
  const search = Route.useSearch()
  return <StudentsRequestsView query={search} />
}
