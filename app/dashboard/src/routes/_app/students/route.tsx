import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { StudentsSectionNav } from '#/features/students'

/**
 * Students section (spec 06). Spec 11 matrix: every staff role can read
 * student data; write actions gate per screen (admin/editor, messaging
 * admin/support) and are re-enforced server-side. S-4.3 explicitly grants
 * Viewer, hence the union guard here.
 */
const STUDENTS_ROLES = ['admin', 'editor', 'reviewer', 'viewer', 'support'] as const

export const Route = createFileRoute('/_app/students')({
  beforeLoad: async () => {
    await requireRolesBeforeLoad(STUDENTS_ROLES)
  },
  component: () => (
    <>
      <StudentsSectionNav />
      <Outlet />
    </>
  ),
})
