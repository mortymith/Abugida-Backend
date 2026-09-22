import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuthBeforeLoad } from '@abugida/auth/tanstack/server'
import { getServerRole } from '#/features/auth'
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
