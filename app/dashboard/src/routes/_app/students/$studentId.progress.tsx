import { createFileRoute } from '@tanstack/react-router'
import { StudentsProgressView } from '#/features/students'

export const Route = createFileRoute('/_app/students/$studentId/progress')({
  component: StudentsProgressPage,
})

/** S-4.3 Student Progress Dashboard (all staff roles per spec). */
function StudentsProgressPage() {
  const { studentId } = Route.useParams()
  return <StudentsProgressView studentId={studentId} />
}
