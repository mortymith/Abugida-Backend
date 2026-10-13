import { createServerFn } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { CourseDetail } from '#/features/courses'
import { validateCourseWorkspaceSearch } from '#/features/courses/courses.workspace'

const getCoursePreviewUrl = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('#/config/app.config')
  return env.COURSE_PREVIEW_URL
})

/**
 * S-2.6 Course Workspace route.
 *
 * Five roles reach the route — admin, editor, reviewer, viewer and support —
 * because the spec filters *affordances inside* the workspace, not the route
 * itself. A Reviewer opens the same item an Editor sees and acts on the review;
 * Support resolves the route and sees the Students tab only. Gating the route to
 * admin/editor/viewer would turn those two into 403s, which is exactly what the
 * three-case permission rule says must not happen.
 *
 * `validateSearch` normalises `tab`, `item` and `atab` once at the boundary —
 * every field stays **optional** so a link that omits `search` still typechecks
 * and lands on the default tab. The *resolved* tab (default applied, role
 * clamped) is computed inside the shell, not here: the route must not need to
 * know the caller's role.
 */
export const Route = createFileRoute('/_app/courses/$courseId')({
  validateSearch: (search: Record<string, unknown>) => validateCourseWorkspaceSearch(search),
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'editor', 'reviewer', 'viewer', 'support']),
  loader: () => getCoursePreviewUrl(),
  component: CourseDetailRoute,
})

function CourseDetailRoute() {
  const { courseId } = Route.useParams()
  const previewBaseUrl = Route.useLoaderData()
  const role = useRole()
  return <CourseDetail courseId={courseId} role={role} previewBaseUrl={previewBaseUrl} />
}
