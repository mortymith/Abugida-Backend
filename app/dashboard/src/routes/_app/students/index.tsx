import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { StudentsDirectoryView } from '#/features/students'
import {
  directoryQueryOptions,
  directoryStatsQueryOptions,
} from '#/features/students/hooks/students.queries'

const directorySearchSchema = z.object({
  q: z.string().optional(),
  course: z.union([z.literal('all'), z.string().uuid()]).optional(),
  status: z.enum(['all', 'active', 'pending_verification', 'locked', 'suspended']).optional(),
  sort: z.enum(['name', 'joined', 'last_active', 'courses', 'progress']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/_app/students/')({
  validateSearch: directorySearchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    course: search.course,
    status: search.status,
    sort: search.sort,
    page: search.page,
  }),
  loader: ({ context, deps }) =>
    // Warm both caches; failures surface per-surface via component queries.
    Promise.allSettled([
      context.queryClient.ensureQueryData(
        directoryQueryOptions({
          q: deps.q,
          course: deps.course,
          status: deps.status,
          sort: deps.sort,
          page: deps.page,
        }),
      ),
      context.queryClient.ensureQueryData(directoryStatsQueryOptions()),
    ]),
  component: StudentsDirectoryPage,
})

/** S-4.1 Student Directory. */
function StudentsDirectoryPage() {
  const search = Route.useSearch()
  return <StudentsDirectoryView query={search} />
}
