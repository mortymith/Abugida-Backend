import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { TeamView, teamQueryOptions } from '#/features/settings'

/**
 * S-6.2 Team Management (admin only).
 */
export const Route = createFileRoute('/_app/settings/team')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(teamQueryOptions()).catch(() => undefined),
  component: TeamView,
})
