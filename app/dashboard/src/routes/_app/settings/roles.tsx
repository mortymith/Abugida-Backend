import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { RolesView, rolesQueryOptions } from '#/features/settings'

/**
 * S-6.9 Roles & Permissions (admin only).
 */
export const Route = createFileRoute('/_app/settings/roles')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(rolesQueryOptions()).catch(() => undefined),
  component: RolesView,
})
