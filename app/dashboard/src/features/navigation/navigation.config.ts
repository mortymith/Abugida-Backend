import {
  AnalyticsUpIcon,
  Book01Icon,
  CheckmarkCircle02Icon,
  DashboardCircleIcon,
  Folder02Icon,
  MarketingIcon,
  Settings02Icon,
  StudentsIcon,
} from '@hugeicons/core-free-icons'
import type { PlatformRole } from '#/features/auth'

/**
 * S-A.1 Global navigation — the **Nav Item → Capability** contract.
 *
 * This table *is* the spec: an item a role cannot use is **absent** from the
 * sidebar, never disabled (spec 11 § Permission-aware UI, case 1). Every row
 * below therefore carries the capability that grants it, so a new role is a data
 * change here rather than a `if` in a component.
 *
 *   | Nav item        | Granted by               | admin editor reviewer viewer support |
 *   | ---------------- | ------------------------ | ----- ------ -------- ------ ------- |
 *   | Dashboard       | any workspace member    |  ✔     ✔      ✔        ✔       ✔     |
 *   | Courses         | `courses.read`          |  ✔     ✔      ✔        ✔       ✖     |
 *   | Media           | `assets.read`           |  ✔     ✔      ✔        ✔       ✔     |
 *   | Students        | `students.read`         |  ✔     ✔      ✔        ✔       ✔     |
 *   | Review          | `course.review`         |  ✔     ✖      ✔        ✖       ✖     |
 *   | Analytics       | any module with data    |  ✔     ✔      ✔        ✔       ✖     |
 *   | Marketing       | `marketing.write`       |  ✔     ✔      ✔        ✔       ✔     |
 *   | Settings        | `settings.write`        |  ✔     ✖      ✖        ✖       ✖     |
 *   | New Course ▾    | `course.create`         |  ✔     ✔      ✖        ✖       ✖     |
 *
 * The order is the sidebar's visual order and matches the S-A.1 wireframe; the
 * command palette's "Go to" group is built from this same list so the two can
 * never disagree about what a role can reach.
 */

export interface NavItem {
  id: string
  label: string
  icon: typeof DashboardCircleIcon
  /** Module root; nav items always navigate to a module root (S-A.1). */
  to: string
  /** Spec capability that grants this item — documentation, and the test seam. */
  capability: string
  roles: readonly PlatformRole[]
  /** Roles that see a live pending-review badge on this item. */
  badgeFor?: readonly PlatformRole[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: DashboardCircleIcon,
    to: '/dashboard',
    capability: 'workspace member',
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
  },
  {
    id: 'courses',
    label: 'Courses',
    icon: Book01Icon,
    to: '/courses',
    capability: 'courses.read',
    roles: ['admin', 'editor', 'reviewer', 'viewer'],
    // The Courses badge counts pending review work across curriculum items and
    // whole courses (spec S-A.1, Revision 2).
    badgeFor: ['admin', 'reviewer'],
  },
  {
    id: 'media',
    label: 'Media',
    icon: Folder02Icon,
    to: '/media',
    capability: 'assets.read',
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
  },
  {
    id: 'students',
    label: 'Students',
    icon: StudentsIcon,
    to: '/students',
    capability: 'students.read',
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
  },
  {
    id: 'review',
    label: 'Review',
    icon: CheckmarkCircle02Icon,
    to: '/courses/reviews',
    capability: 'course.review',
    roles: ['admin', 'reviewer'],
    badgeFor: ['admin', 'reviewer'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: AnalyticsUpIcon,
    to: '/analytics',
    // Revenue is redacted **server-side** for roles without
    // `finance.view_revenue`, so the module itself is open to every role that
    // has any data; Support is absent because it has no analytics grant.
    capability: 'analytics.read',
    roles: ['admin', 'editor', 'reviewer', 'viewer'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: MarketingIcon,
    to: '/marketing',
    capability: 'marketing.write',
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings02Icon,
    to: '/settings',
    capability: 'settings.write',
    roles: ['admin'],
  },
]

/** Header "New Course" split button — `course.create`, absent for other roles. */
export const CREATE_COURSE_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/** Roles whose navigation exposes the Review item and queue. */
export const REVIEW_ROLES: readonly PlatformRole[] = ['admin', 'reviewer']

/** Roles allowed to open the revenue tab (`finance.view_revenue`). */
export const REVENUE_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/** Roles that author course content — gates Resume authoring (S-A.1). */
export const COURSE_AUTHORING_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/**
 * The nav the signed-in role may open. An item the role cannot use is absent
 * from the result — never rendered disabled — so a Support user has no
 * course-authoring entry at all.
 */
export function getVisibleNavItems(role: PlatformRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

/**
 * Visual grouping of the same items, in the same order.
 *
 * The groups exist for the **eye**, not for authorisation: `roles` above still
 * decides visibility, and every item is listed exactly once, so a group can never
 * disagree with the item list it points at. Grouping gives the rail two anchors —
 * _Workspace_ (the daily destinations) and _Manage_ (the occasional ones) —
 * instead of eight peers in one undifferentiated list.
 *
 * A group whose items are all invisible to the role is dropped rather than
 * rendered as a bare label, so a Viewer never sees an empty "Manage" heading.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    itemIds: ['dashboard', 'courses', 'media', 'students', 'review'],
  },
  { id: 'manage', label: 'Manage', itemIds: ['analytics', 'marketing', 'settings'] },
]

export interface NavGroup {
  id: string
  /** Rendered as a `SidebarGroupLabel`; hidden automatically in the icon rail. */
  label: string
  itemIds: readonly string[]
}

/**
 * `NAV_ITEMS` sliced into the visible groups, in visual order.
 *
 * An item in `NAV_ITEMS` but in no group would silently vanish from the rail, so
 * any such item is appended to an implicit trailing group rather than dropped.
 */
export function getVisibleNavGroups(
  role: PlatformRole,
): Array<{ id: string; label: string; items: NavItem[] }> {
  const byId = new Map(NAV_ITEMS.map((item) => [item.id, item]))
  const grouped = new Set(NAV_GROUPS.flatMap((group) => group.itemIds))

  const groups = NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.itemIds
      .map((id) => byId.get(id))
      .filter((item): item is NavItem => item != null && item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)

  const orphans = NAV_ITEMS.filter((item) => !grouped.has(item.id) && item.roles.includes(role))
  if (orphans.length > 0) groups.push({ id: 'other', label: 'More', items: orphans })

  return groups
}

export function canCreateCourse(role: PlatformRole): boolean {
  return CREATE_COURSE_ROLES.includes(role)
}

export function canReview(role: PlatformRole): boolean {
  return REVIEW_ROLES.includes(role)
}

export function canSeeRevenue(role: PlatformRole): boolean {
  return REVENUE_ROLES.includes(role)
}

/** `true` when the path belongs to the module — used for `aria-current`. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/courses') return pathname === '/courses' || pathname.startsWith('/courses/')
  if (item.to === '/courses/reviews') return pathname === '/courses/reviews'
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/**
 * Review items live at `/courses/*`, so "is Courses active?" and "is Review
 * active?" have to be decided together: opening the queue must light **Review**
 * only, otherwise two items claim `aria-current="page"` at once.
 */
export function getActiveNavItemId(role: PlatformRole, pathname: string): string | null {
  if (pathname === '/courses/reviews') return canReview(role) ? 'review' : null
  return getVisibleNavItems(role).find((item) => isNavItemActive(item, pathname))?.id ?? null
}

// ── Review badge (S-A.1 · deterministic rules) ──────────────────────────────

/** Above this the badge reads `99+`; the exact count lives in the name. */
export const BADGE_CAP = 99

/** Cap at 99+ while the exact count stays reachable on the queue screen. */
export function formatBadgeCount(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count)
}

/**
 * A badge's accessible name and `title`.
 *
 * - **Courses badge** (no assignment): _"5 open reviews awaiting review"_ — the
 *   review work that exists in the workspace.
 * - **Review badge**: _"2 of 5 assigned to you"_ — what the signed-in reviewer
 *   can actually decide. The exact count is always reachable here even when the
 *   visible label is capped at `99+`.
 */
export function badgeAccessibleName(count: number, assignedToMe?: number): string {
  const reviews = count === 1 ? 'review' : 'reviews'
  if (typeof assignedToMe === 'number') {
    return `${assignedToMe} of ${count} open ${reviews} assigned to you`
  }
  return `${count} open ${reviews} awaiting review`
}
