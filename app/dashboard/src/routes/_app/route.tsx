import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuthBeforeLoad } from '@abugida/auth/tanstack'
import { authServerFns } from '#/config/auth.config'

export const Route = createFileRoute('/_app')({
  beforeLoad: requireAuthBeforeLoad(authServerFns, {
    loginPath: import.meta.env.VITE_LOGIN_PATH,
  }),
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card p-4">
        <div className="mb-6">
          <span className="text-lg font-semibold">{import.meta.env.VITE_APP_NAME}</span>
        </div>
        <nav className="space-y-1">
          <a
            href="/dashboard"
            className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Dashboard
          </a>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="border-b bg-card px-6 py-4">
          <span className="text-sm text-muted-foreground">Dashboard</span>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
