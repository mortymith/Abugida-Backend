import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { SecurityView, securityPoliciesQueryOptions } from '#/features/settings'

/**
 * S-6.8 Security & Audit Log (admin only).
 */
export const Route = createFileRoute('/_app/settings/security')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(securityPoliciesQueryOptions()).catch(() => undefined),
  component: SecurityView,
})
