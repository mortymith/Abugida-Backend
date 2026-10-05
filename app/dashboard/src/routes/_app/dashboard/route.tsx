import { Outlet, createFileRoute, Link, useMatches } from '@tanstack/react-router'
import { cn } from 'cn'
import { useRole, REVENUE_ROLES } from '#/features/auth'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardSection,
})

/**
 * Dashboard section layout: Overview | Revenue sub-navigation.
 *
 * The section owns the tabs only — **no heading**. Each screen under it renders
 * its own `PageHeader`, so there is exactly one `<h1>` per screen (S-1.1
 * "Dashboard", S-1.2 "Revenue Analytics") instead of a heading the screen
 * duplicates or contradicts.
 *
 * The Revenue tab is hidden for roles without revenue access (spec 11
 * permission-aware UI: out of capability → absent, not disabled).
 */
function DashboardSection() {
  const role = useRole()
  const canSeeRevenue = REVENUE_ROLES.includes(role)
  const matches = useMatches()
  const isRevenue = matches.some((match) => match.routeId === '/_app/dashboard/revenue')

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <nav aria-label="Dashboard sections" className="flex items-center gap-1">
        <TabLink to="/dashboard" active={!isRevenue}>
          Overview
        </TabLink>
        {canSeeRevenue ? (
          <TabLink to="/dashboard/revenue" active={isRevenue}>
            Revenue
          </TabLink>
        ) : null}
      </nav>
      <Outlet />
    </div>
  )
}

function TabLink({
  to,
  active,
  children,
}: {
  to: '/dashboard' | '/dashboard/revenue'
  active: boolean
  children: string
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 min-w-10 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
