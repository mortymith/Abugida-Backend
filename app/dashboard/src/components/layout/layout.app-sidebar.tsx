import { useCallback, useEffect, useRef } from 'react'
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
  SidebarGroupLabel,
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
import { WorkspaceSwitcherRow, useWorkspaceSwitcherShortcut } from './layout.workspace-switcher'
import {
  badgeAccessibleName,
  canReview,
  formatBadgeCount,
  getActiveNavItemId,
  getVisibleNavGroups,
  trackNavEvent,
} from '#/features/navigation'
import { pendingReviewCountQueryOptions } from '#/features/courses/hooks/courses.queries'
import type { PendingReviewCounts } from '#/features/courses/courses.types'
import { useWorkspaceContext, useWorkspaceRole } from '#/features/workspaces'
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
 * - Items are grouped into _Workspace_ and _Manage_ (`NAV_GROUPS`) so the rail has
 *   two anchors instead of eight peers. The grouping is presentational only:
 *   visibility still comes from each item's `roles`.
 */
export function AppSidebar() {
  const role = useWorkspaceRole()
  // `⌘/Ctrl+Shift+O` belongs to the shell, not to the control that happens to be
  // mounted, so it works from every screen.
  useWorkspaceSwitcherShortcut()
  // The sidebar wordmark titles the navigation with the active organization,
  // so the nav says which workspace everything below it belongs to.
  const activeWorkspaceName = useWorkspaceContext().workspaces.find((w) => w.isActive)?.name
  const navGroups = getVisibleNavGroups(role)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const activeId = getActiveNavItemId(role, pathname)
  const { isMobile, setOpenMobile } = useSidebar()

  // The badge counts pending review work; only Admin and Reviewer can act on it,
  // so no other role runs the query at all.
  const pendingReviews = useQuery(pendingReviewCountQueryOptions(canReview(role)))

  // The active destination is always in view, even when it sits below the fold of
  // a long rail (or of a scrolled drawer) — arriving at a page whose nav shows no
  // selection is disorienting on a screen with no other orientation cue.
  useEffect(() => {
    if (!activeId) return
    const nav = document.getElementById(PRIMARY_NAV_ID)
    nav?.querySelector(`[data-nav-id="${activeId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  // On mobile the sidebar is a `Sheet` **over** the destination, so choosing a
  // destination has to dismiss it — otherwise the new page loads behind a drawer
  // the user believes they already closed.
  const closeMobileDrawer = useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" />}
              onClick={closeMobileDrawer}
            >
              <Logo className="gap-2" name={activeWorkspaceName} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/*
          On mobile the workspace name is the first row of the drawer, above the
          nav items (S-13.2 Placement). On desktop the sidebar wordmark already
          carries it, so the drawer row is the only repeat.
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
          {navGroups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <PrimaryNav>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.id} data-tour-target={`nav-${item.id}`}>
                      <NavMenuButton
                        item={item}
                        active={activeId === item.id}
                        onNavigate={closeMobileDrawer}
                      />
                      {item.badgeFor?.includes(role) ? (
                        <ReviewBadge
                          item={item.id}
                          counts={pendingReviews.data ?? { total: 0, assignedToMe: 0 }}
                        />
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                </PrimaryNav>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
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

function NavMenuButton({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: () => void
}) {
  return (
    <SidebarMenuButton
      isActive={active}
      tooltip={item.label}
      data-nav-id={item.id}
      render={<Link to={item.to} />}
      aria-current={active ? 'page' : undefined}
      // The accessible name is present at every width — expansion is a visual
      // change only. The visible label stays in the DOM either way.
      aria-label={item.label}
      onClick={() => {
        trackNavEvent('nav.item_activated', { item: item.id })
        onNavigate()
      }}
      // Active is never colour alone: a rail marker plus a bolder weight. The
      // marker is absolutely positioned inside the (already `relative`) menu
      // item, so selecting an item costs **no layout** — a border on the button
      // itself would shift every label by 2px on each navigation.
      className={cn(active && 'font-semibold')}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-active"
        />
      ) : null}
      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
      <span>{item.label}</span>
    </SidebarMenuButton>
  )
}

/**
 * S-A.1 review badges. Renders nothing at zero (the item stays), caps at `99+`,
 * and carries the exact count in its accessible name and `title`.
 *
 * The two badges answer different questions and deliberately carry different
 * numbers:
 *
 * - **Courses** — every open submission in the workspace.
 * - **Review** — the submissions the signed-in reviewer can decide (the ones
 *   they did not author), named _"2 of 5 assigned to you"_ when the two differ.
 */
function ReviewBadge({ item, counts }: { item: string; counts: PendingReviewCounts }) {
  const { total, assignedToMe } = counts
  if (item === 'courses') {
    if (total <= 0) return null
    return <BadgePill count={total} name={badgeAccessibleName(total)} />
  }
  if (assignedToMe <= 0) return null
  return <BadgePill count={assignedToMe} name={badgeAccessibleName(total, assignedToMe)} />
}

function BadgePill({ count, name }: { count: number; name: string }) {
  return (
    <SidebarMenuBadge className="max-w-16 truncate" title={name}>
      <span aria-hidden="true">{formatBadgeCount(count)}</span>
      <span className="sr-only">{name}</span>
    </SidebarMenuBadge>
  )
}
