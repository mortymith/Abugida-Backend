import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { IntegrationsView, integrationsQueryOptions } from '#/features/settings'

/**
 * S-6.3 Integrations (admin only).
 */
export const Route = createFileRoute('/_app/settings/integrations')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(integrationsQueryOptions()).catch(() => undefined),
  component: IntegrationsView,
})
