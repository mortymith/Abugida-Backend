import { Link, useRouterState } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { cn } from '#/lib/utils'

/**
 * Sub-navigation for the Marketing & Growth module (spec 10, S-A.1 Marketing
 * group). Per the spec 11 matrix every screen is visible view-only to
 * Reviewer/Viewer/Support; write actions are gated per screen.
 */
const TABS: Array<{ to: string; label: string }> = [
  { to: '/marketing/campaigns', label: 'Email Campaigns' },
  { to: '/marketing/templates', label: 'Email Templates' },
  { to: '/marketing/coupons', label: 'Discount & Coupons' },
  { to: '/marketing/affiliates', label: 'Affiliate Program' },
  { to: '/marketing/testimonials', label: 'Testimonials' },
]

export function MarketingSectionNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav aria-label="Marketing sections" className="mb-6 flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.to)
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

/** Convenience hook shared by the marketing views. */
export function useMarketingPermissions() {
  const role = useRole()
  return {
    role,
    canWrite: role === 'admin' || role === 'editor',
    canModerate: role === 'admin' || role === 'editor' || role === 'support',
    canPayout: role === 'admin',
  }
}
