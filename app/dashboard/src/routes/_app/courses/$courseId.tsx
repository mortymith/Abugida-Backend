import { createServerFn } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { CourseDetail } from '#/features/courses'

const getCoursePreviewUrl = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('#/config/app.config')
  return env.COURSE_PREVIEW_URL
})

export const Route = createFileRoute('/_app/courses/$courseId')({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'editor', 'viewer']),
  loader: () => getCoursePreviewUrl(),
  component: CourseDetailRoute,
})

function CourseDetailRoute() {
  const { courseId } = Route.useParams()
  const previewBaseUrl = Route.useLoaderData()
  const role = useRole()
  return <CourseDetail courseId={courseId} role={role} previewBaseUrl={previewBaseUrl} />
}
