import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { LIBRARY_VIEW_ROLES } from '#/features/media/media.permissions'

/**
 * Media section (spec 05). Spec 11 matrix: Admin/Editor full,
 * Reviewer/Viewer view-only, Support no access. Write operations are
 * additionally enforced server-side (admin/editor only).
 */
export const Route = createFileRoute('/_app/media')({
  beforeLoad: async () => {
    await requireRolesBeforeLoad(LIBRARY_VIEW_ROLES)
  },
  component: Outlet,
})
