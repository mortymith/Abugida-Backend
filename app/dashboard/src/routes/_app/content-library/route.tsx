import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'

/**
 * Content Library section (spec 05). Spec 11 matrix: Admin/Editor full,
 * Reviewer/Viewer view-only, Support no access. Write operations are
 * additionally enforced server-side (admin/editor only).
 */
const LIBRARY_ROLES = ['admin', 'editor', 'reviewer', 'viewer'] as const

export const Route = createFileRoute('/_app/content-library')({
  beforeLoad: async () => {
    await requireRolesBeforeLoad(LIBRARY_ROLES)
  },
  component: Outlet,
})
