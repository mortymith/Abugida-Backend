import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuthBeforeLoad } from '@abugida/auth/tanstack/guard'
import { getWorkspaceContext } from '#/features/workspaces'
import { readSidebarOpen } from '#/features/navigation'
import { SidebarProvider, SidebarInset } from '#/components/ui/sidebar'
import { TooltipProvider } from '#/components/ui/tooltip'
import { AppSidebar } from '#/components/layout/layout.app-sidebar'
import { Header } from '#/components/layout/layout.header'
import { AppRouteError } from '#/components/layout/layout.route-error'
import { RouteAnnouncer } from '#/components/layout/layout.route-announcer'
import { ShellOfflineBanner } from '#/components/layout/layout.offline-shell-banner'
import { SessionExpiryWarning } from '#/components/layout/layout.session-expiry'
import { OnboardingTour } from '#/features/onboarding'

export const Route = createFileRoute('/_app')({
  beforeLoad: async (args) => {
    const { authServerFns } = await import('#/config/auth.config')
    const auth = await requireAuthBeforeLoad(authServerFns, {
      loginPath: import.meta.env.VITE_LOGIN_PATH,
    })(args)

    // The workspace is the scope of everything below: the navigation is built
    // from the **active workspace's** grants and is rebuilt on every switch, so
    // a second workspace's role can never leak into this one (S-13.2).
    const workspace = await getWorkspaceContext()

    // Kept as a top-level `role` for the many `useRole()` call sites; it is the
    // same value, resolved from the same place, so a guard can never disagree
    // with the navigation.
    const { role } = workspace

    /*
     * The sidebar's collapsed/expanded preference, read on the server so SSR
     * renders the rail the user last chose. Without this the wide rail is
     * rendered on every page load and snaps shut after hydration — a flash for
     * anyone who collapsed it. `undefined` means no opinion (first visit), which
     * the shell reads as open. Client-side navigations re-run `beforeLoad`
     * without a request, hence the guard.
     */
    let sidebarOpen: boolean | undefined
    try {
      const { getRequest } = await import('@tanstack/react-start/server')
      sidebarOpen = readSidebarOpen(getRequest().headers.get('cookie'))
    } catch {
      sidebarOpen = undefined
    }

    // A claimable invite is captured on the login screen, before there was a
    // session, so its ticket is redeemed here — the first authenticated entry
    // point. Never let it block navigation: an invite is worth a retry, the
    // dashboard is not worth a spinner.
    const { redeemPendingClaim } = await import('#/features/auth/auth.pending-claim')
    void redeemPendingClaim().catch(() => undefined)

    return { ...auth, role, workspace, sidebarOpen }
  },
  // 403 and 404 render **inside** this shell (see `layout.route-error.tsx`):
  // the sidebar and header stay mounted, so the user can navigate out.
  errorComponent: AppRouteError,
  component: AppLayout,
})

function AppLayout() {
  // Resolved in `beforeLoad`, so SSR and hydration agree on the rail's width.
  const { sidebarOpen } = Route.useRouteContext()

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarOpen ?? true}>
        {/*
          Skip to content: the **first focusable element in the DOM** on every
          authenticated route, visible on focus, targeting the main region's
          `tabindex="-1"` (S-A.1 · Keyboard & Focus).
        */}
        <a
          href="#main"
          className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>

        <AppSidebar />
        <SidebarInset>
          <Header />
          <ShellOfflineBanner />
          <main
            id="main"
            tabIndex={-1}
            data-route-content
            className="flex-1 overflow-auto p-6 outline-none"
          >
            <Outlet />
          </main>
        </SidebarInset>

        <RouteAnnouncer />
        {/*
          Session expiry is owned by the shell (spec 11): the 2-minute warning must
          survive every route change and name the surfaces holding unsaved work.
        */}
        <SessionExpiryWarning />
        {/* S-7.6: first-login product tour; replayable from Help & Support. */}
        <OnboardingTour />
      </SidebarProvider>
    </TooltipProvider>
  )
}
