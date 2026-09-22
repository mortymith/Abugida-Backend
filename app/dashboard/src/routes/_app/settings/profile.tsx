import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { ProfileView, profileQueryOptions } from '#/features/settings'

/**
 * S-6.5 My Profile & Account — every role, own record only (spec 11).
 * Reached from the header avatar and the Settings section nav.
 */
export const Route = createFileRoute('/_app/settings/profile')({
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'editor', 'reviewer', 'viewer', 'support']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(profileQueryOptions()).catch(() => undefined),
  component: ProfileView,
})
