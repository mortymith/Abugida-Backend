import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireRolesBeforeLoad } from '#/features/auth'
import { StudentsMessagingView } from '#/features/students'
import { threadsQueryOptions } from '#/features/students/hooks/students.queries'

const messagingSearchSchema = z.object({
  q: z.string().optional(),
  filter: z.enum(['all', 'unread', 'broadcast']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  /** Deep link from a profile: pre-open the student's latest thread. */
  student: z.string().uuid().optional(),
  /** Deep link from a cohort: pre-select the broadcast audience. */
  cohort: z.string().uuid().optional(),
})

export const Route = createFileRoute('/_app/students/messaging')({
  validateSearch: messagingSearchSchema,
  beforeLoad: async () => {
    // S-4.5 is Admin/Support only (spec 11 matrix).
    await requireRolesBeforeLoad(['admin', 'support'])
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    filter: search.filter,
    page: search.page,
  }),
  loader: ({ context, deps }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        threadsQueryOptions({
          q: deps.q,
          filter: deps.filter,
          page: deps.page,
        }),
      ),
    ]),
  component: StudentsMessagingPage,
})

/** S-4.5 Messaging Center. */
function StudentsMessagingPage() {
  const search = Route.useSearch()
  return (
    <StudentsMessagingView
      query={{ q: search.q, filter: search.filter, page: search.page }}
      initialStudentId={search.student}
      initialCohortPublicId={search.cohort}
    />
  )
}
