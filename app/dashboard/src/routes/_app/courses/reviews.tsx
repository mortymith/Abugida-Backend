import { createFileRoute } from '@tanstack/react-router'
import { useRole, requireRolesBeforeLoad } from '#/features/auth'
import { ReviewsQueue } from '#/features/courses'

export const Route = createFileRoute('/_app/courses/reviews')({
  validateSearch: (search: Record<string, unknown>): { state?: string } => ({
    state: typeof search.state === 'string' ? search.state : undefined,
  }),
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'reviewer']),
  component: ReviewsRoute,
})

function ReviewsRoute() {
  const role = useRole()
  return <ReviewsQueue role={role} />
}
