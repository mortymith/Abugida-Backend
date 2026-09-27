import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { MarketingSectionNav } from '#/features/marketing'

/**
 * Marketing & Growth section layout (spec 10). Per the spec 11 matrix the
 * module is viewable by every staff role; write actions and payout runs are
 * gated per screen and re-checked server-side in every function.
 */
const MARKETING_ROLES = ['admin', 'editor', 'reviewer', 'viewer', 'support'] as const

export const Route = createFileRoute('/_app/marketing')({
  beforeLoad: async () => {
    await requireRolesBeforeLoad(MARKETING_ROLES)
  },
  component: () => (
    <>
      <MarketingSectionNav />
      <Outlet />
    </>
  ),
})
