import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { BillingView, billingQueryOptions } from '#/features/settings'

/**
 * S-6.6 Billing & Subscription (admin only).
 */
export const Route = createFileRoute('/_app/settings/billing')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(billingQueryOptions()).catch(() => undefined),
  component: BillingView,
})
