import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuthBeforeLoad } from '@abugida/auth/tanstack/guard'
import { getServerRole } from '#/features/auth/server'
import { SidebarProvider, SidebarInset } from '#/components/ui/sidebar'
import { TooltipProvider } from '#/components/ui/tooltip'
import { AppSidebar } from '#/components/layout/layout.app-sidebar'
import { Header } from '#/components/layout/layout.header'
import { OnboardingTour } from '#/features/onboarding'

export const Route = createFileRoute('/_app')({
  beforeLoad: async (args) => {
    const { authServerFns } = await import('#/config/auth.config')
    const auth = await requireAuthBeforeLoad(authServerFns, {
      loginPath: import.meta.env.VITE_LOGIN_PATH,
    })(args)

    // Resolve the platform role once per navigation (spec 11 roles matrix).
    // Consumed downstream via useRole() / route context.
    const role = await getServerRole()

    // A claimable invite is captured on the login screen, before there was a
    // session, so its ticket is redeemed here — the first authenticated entry
    // point. Never let it block navigation: an invite is worth a retry, the
    // dashboard is not worth a spinner.
    const { redeemPendingClaim } = await import('#/features/auth/auth.pending-claim')
    void redeemPendingClaim().catch(() => undefined)

    return { ...auth, role }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </SidebarInset>
        {/* S-7.6: first-login product tour; replayable from Help & Support. */}
        <OnboardingTour />
      </SidebarProvider>
    </TooltipProvider>
  )
}
