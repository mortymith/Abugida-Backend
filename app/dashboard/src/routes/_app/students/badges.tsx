import { createFileRoute } from '@tanstack/react-router'
import { StudentsBadgesView } from '#/features/students'
import {
  badgesQueryOptions,
  badgeHistoryQueryOptions,
} from '#/features/students/hooks/students.queries'

export const Route = createFileRoute('/_app/students/badges')({
  loader: ({ context }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(badgesQueryOptions()),
      context.queryClient.ensureQueryData(badgeHistoryQueryOptions({})),
    ]),
  component: StudentsBadgesPage,
})

/** S-4.7 Badges & Achievements. */
function StudentsBadgesPage() {
  return <StudentsBadgesView />
}
