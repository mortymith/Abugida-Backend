import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { GeneralSettingsView, generalSettingsQueryOptions } from '#/features/settings'

/**
 * S-6.1 General Settings (admin only, spec 11 matrix).
 */
export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(generalSettingsQueryOptions()).catch(() => undefined),
  component: GeneralSettingsView,
})
