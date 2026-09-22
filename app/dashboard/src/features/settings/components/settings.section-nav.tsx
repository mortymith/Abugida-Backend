import { Link, useRouterState } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { cn } from '#/lib/utils'

/**
 * Sub-navigation for the Settings module (spec 08). Per the spec 11 matrix,
 * workspace settings (S-6.1..S-6.4, S-6.6..S-6.10) are admin-only; My Profile
 * (S-6.5) is reachable for every role and also opens from the header avatar.
 */
const TABS: Array<{ to: string; label: string; roles: readonly string[] | null }> = [
  { to: '/settings', label: 'General', roles: ['admin'] },
  { to: '/settings/team', label: 'Team', roles: ['admin'] },
  { to: '/settings/integrations', label: 'Integrations', roles: ['admin'] },
  { to: '/settings/branding', label: 'Branding', roles: ['admin'] },
  { to: '/settings/profile', label: 'My Profile', roles: null },
  { to: '/settings/billing', label: 'Billing', roles: ['admin'] },
  { to: '/settings/api', label: 'API & Webhooks', roles: ['admin'] },
  { to: '/settings/security', label: 'Security', roles: ['admin'] },
  { to: '/settings/roles', label: 'Roles & Permissions', roles: ['admin'] },
  { to: '/settings/privacy', label: 'Privacy', roles: ['admin'] },
]

export const SETTINGS_SECTION_NAV = TABS

export function SettingsSectionNav() {
  const role = useRole()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const tabs = TABS.filter((tab) => tab.roles == null || tab.roles.includes(role))

  return (
    <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const active =
          tab.to === '/settings' ? pathname === '/settings' : pathname.startsWith(tab.to)
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
