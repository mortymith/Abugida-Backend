import { createFileRoute } from '@tanstack/react-router'
import { StudentsRulesView } from '#/features/students'
import { rulesQueryOptions } from '#/features/students/hooks/students.queries'

export const Route = createFileRoute('/_app/students/rules')({
  loader: ({ context }) =>
    Promise.allSettled([context.queryClient.ensureQueryData(rulesQueryOptions())]),
  component: StudentsRulesPage,
})

/** S-4.8 Automated Enrollment Rules. */
function StudentsRulesPage() {
  return <StudentsRulesView />
}
