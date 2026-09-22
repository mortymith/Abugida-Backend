import { Link, useRouterState } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { cn } from '#/lib/utils'

/**
 * Sub-navigation for the Students module (spec 06). Per spec 11, messaging
 * is admin/support only; every other screen is readable by all staff roles
 * while write actions gate themselves.
 */
const TABS: Array<{ to: string; label: string; roles: readonly string[] | null }> = [
  { to: '/students', label: 'Directory', roles: null },
  { to: '/students/cohorts', label: 'Cohorts', roles: null },
  { to: '/students/requests', label: 'Requests', roles: null },
  { to: '/students/badges', label: 'Badges', roles: null },
  { to: '/students/rules', label: 'Rules', roles: null },
  { to: '/students/messaging', label: 'Messaging', roles: ['admin', 'support'] },
]

export function StudentsSectionNav() {
  const role = useRole()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const tabs = TABS.filter((tab) => tab.roles == null || tab.roles.includes(role))

  return (
    <nav aria-label="Students sections" className="mb-6 flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const active =
          tab.to === '/students'
            ? pathname === '/students' || /^\/students\/[^/]+/.test(pathname)
            : pathname.startsWith(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
