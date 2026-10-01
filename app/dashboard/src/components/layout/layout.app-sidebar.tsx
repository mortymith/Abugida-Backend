import { useCallback, useRef } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import type { NavItem } from '#/features/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '#/components/ui/sidebar'
import { Logo } from '#/components/common/logo'
import { SidebarUserSection } from './layout.sidebar-user-section'
import { WorkspaceSwitcherRow } from './layout.workspace-switcher'
import {
  badgeAccessibleName,
  canReview,
  formatBadgeCount,
  getActiveNavItemId,
  getVisibleNavItems,
  trackNavEvent,
} from '#/features/navigation'
import { pendingReviewCountQueryOptions } from '#/features/courses/hooks/courses.queries'
import { useWorkspaceRole } from '#/features/workspaces'
import { cn } from '#/lib/utils'

/** Target of the collapse control's `aria-controls` (S-A.1 · Keyboard & Focus). */
export const PRIMARY_NAV_ID = 'primary-navigation'

/**
 * S-A.1 primary navigation.
 *
 * Contractual behaviours this component owns:
 *
 * - `role="navigation"` with the name **Primary** at every width — the mobile
 *   drawer uses the same name so it never changes with layout.
 * - The active item carries `aria-current="page"` **and** a left rail marker plus
 *   a bolder weight: active state is never colour alone (spec 11). Purple is
 *   reserved for active navigation, never for a status.
 * - Every item keeps an accessible name at 240px **and** 64px — the label is
 *   never removed from the DOM, only clipped by the collapsed layout, because
 *   tooltips are not announced.
 * - Roving keyboard support inside the nav: ↑/↓ move, Home/End jump, Enter
 *   activates through the link itself.
 * - The review badge is deterministic: capped at 99+, absent at zero, refreshed
 *   on focus rather than on a timer (see `pendingReviewCountQueryOptions`).
 */
export function AppSidebar() {
  const role = useWorkspaceRole()
  const navItems = getVisibleNavItems(role)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const activeId = getActiveNavItemId(role, pathname)
  const { isMobile } = useSidebar()

  // The badge counts pending review work; only Admin and Reviewer can act on it,
  // so no other role runs the query at all.
  const pendingReviews = useQuery(pendingReviewCountQueryOptions(canReview(role)))

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <Logo className="gap-2" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/*
          On mobile the workspace name is the first row of the drawer, above the
          nav items (S-13.2 Placement); on desktop it lives in the header,
          leftmost, because it scopes everything below it.
        */}
        {isMobile ? (
          <>
            <SidebarSeparator />
            <WorkspaceSwitcherRow />
          </>
        ) : null}
      </SidebarHeader>

      {/*
        The named navigation region. It wraps the content — not the header or the
        user section — so "Primary" covers exactly the module destinations, and
        the mobile drawer keeps the same accessible name as the desktop rail.
      */}
      <nav id={PRIMARY_NAV_ID} aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <PrimaryNav>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id} data-tour-target={`nav-${item.id}`}>
                    <NavMenuButton item={item} active={activeId === item.id} />
                    {item.badgeFor?.includes(role) && item.id === 'courses' ? (
                      <ReviewBadge count={pendingReviews.data ?? 0} />
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </PrimaryNav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </nav>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarUserSection />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

/**
 * Arrow-key navigation inside the nav list. ↑/↓ move between items and Home/End
 * jump to the ends; Tab still reaches every item, so this adds keyboard speed
 * without turning the list into a roving-focus trap.
 */
function PrimaryNav({ children }: { children: React.ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null)

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const list = listRef.current
    if (!list) return

    const links = Array.from(list.querySelectorAll<HTMLAnchorElement>('a[href]'))
    const current = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (links.length === 0 || current === -1) return

    event.preventDefault()
    const next =
      event.key === 'Home'
        ? links[0]
        : event.key === 'End'
          ? links.at(-1)
          : event.key === 'ArrowDown'
            ? links[(current + 1) % links.length]
            : links[(current - 1 + links.length) % links.length]
    next?.focus()
  }, [])

  return (
    <SidebarMenu ref={listRef} onKeyDown={onKeyDown}>
      {children}
    </SidebarMenu>
  )
}

function NavMenuButton({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <SidebarMenuButton
      isActive={active}
      tooltip={item.label}
      render={<Link to={item.to} />}
      aria-current={active ? 'page' : undefined}
      // The accessible name is present at every width — expansion is a visual
      // change only. The visible label stays in the DOM either way.
      aria-label={item.label}
      onClick={() => trackNavEvent('nav.item_activated', { item: item.id })}
      // Left rail marker + bolder weight: active is never colour alone.
      className={cn(active && 'border-l-2 border-sidebar-active font-semibold')}
    >
      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
      <span>{item.label}</span>
    </SidebarMenuButton>
  )
}

/**
 * S-A.1 Courses badge. Renders nothing at zero (the item stays), caps at 99+,
 * and carries the exact count in its accessible name and `title`.
 */
function ReviewBadge({ count }: { count: number }) {
  if (count <= 0) return null
  const name = badgeAccessibleName(count)
  return (
    <SidebarMenuBadge className="max-w-16 truncate" title={name}>
      <span aria-hidden="true">{formatBadgeCount(count)}</span>
      <span className="sr-only">{name}</span>
    </SidebarMenuBadge>
  )
}
