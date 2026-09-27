import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { SettingsSectionNav } from '#/features/settings'

/**
 * Settings section layout (spec 08). Workspace settings are admin-only; My
 * Profile (S-6.5) is reachable by every role and also opens from the header
 * avatar, so the layout itself does not gate — each child route enforces its
 * own boundary server-side (requireRolesBeforeLoad here, per-screen role
 * checks inside every server function).
 */

export const Route = createFileRoute('/_app/settings')({
  beforeLoad: async ({ params }) => {
    // The layout only validates authentication context; role gating happens
    // per child route so /settings/profile stays open to all staff roles.
    void params
    await requireRolesBeforeLoad(['admin', 'editor', 'reviewer', 'viewer', 'support'], {
      redirectTo: '/dashboard',
    })
  },
  component: () => (
    <>
      <SettingsSectionNav />
      <Outlet />
    </>
  ),
})
