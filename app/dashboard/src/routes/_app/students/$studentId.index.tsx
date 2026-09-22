import { createFileRoute } from '@tanstack/react-router'
import { StudentsProfileView } from '#/features/students'

export const Route = createFileRoute('/_app/students/$studentId/')({
  // Profile tabs are client state; no search params needed yet.
  component: StudentsProfilePage,
})

/** S-4.2 Student Profile. */
function StudentsProfilePage() {
  const { studentId } = Route.useParams()
  return <StudentsProfileView studentId={studentId} />
}
