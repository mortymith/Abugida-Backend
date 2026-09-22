import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { PrivacyView, privacyQueryOptions } from '#/features/settings'

/**
 * S-6.10 Privacy & Data Retention (admin only).
 */
export const Route = createFileRoute('/_app/settings/privacy')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(privacyQueryOptions()).catch(() => undefined),
  component: PrivacyView,
})
