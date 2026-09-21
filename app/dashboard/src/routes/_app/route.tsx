import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuthBeforeLoad } from '@abugida/auth/tanstack/server'
import { SidebarProvider, SidebarInset } from '#/components/ui/sidebar'
import { TooltipProvider } from '#/components/ui/tooltip'
import { AppSidebar } from '#/components/layout/layout.app-sidebar'
import { Header } from '#/components/layout/layout.header'

export const Route = createFileRoute('/_app')({
  beforeLoad: async (args) => {
    const { authServerFns } = await import('#/config/auth.config')
    return requireAuthBeforeLoad(authServerFns, {
      loginPath: import.meta.env.VITE_LOGIN_PATH,
    })(args)
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
      </SidebarProvider>
    </TooltipProvider>
  )
}
