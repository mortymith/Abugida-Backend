import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { ApiWebhooksView, apiKeysQueryOptions, webhooksQueryOptions } from '#/features/settings'

/**
 * S-6.7 API & Webhooks (admin only).
 */
export const Route = createFileRoute('/_app/settings/api')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    // Warm both caches; failures surface per-section via component queries.
    Promise.allSettled([
      context.queryClient.ensureQueryData(apiKeysQueryOptions()),
      context.queryClient.ensureQueryData(webhooksQueryOptions()),
    ]),
  component: ApiWebhooksView,
})
