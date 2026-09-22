import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { BrandingView, brandingQueryOptions } from '#/features/settings'

/**
 * S-6.4 Branding (admin only).
 */
export const Route = createFileRoute('/_app/settings/branding')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(brandingQueryOptions()).catch(() => undefined),
  component: BrandingView,
})
