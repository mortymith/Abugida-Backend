import { createFileRoute } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { env } from '#/config/app.config'
import { CourseDetail } from '#/features/courses'

export const Route = createFileRoute('/_app/courses/$courseId')({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'editor', 'viewer']),
  component: CourseDetailRoute,
})

function CourseDetailRoute() {
  const { courseId } = Route.useParams()
  const role = useRole()
  return <CourseDetail courseId={courseId} role={role} webAppUrl={env.WEB_APP_URL} />
}
