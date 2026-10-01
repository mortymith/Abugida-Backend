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
 *   | Content Library | `assets.read`           |  ✔     ✔      ✔        ✔       ✔     |
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
    id: 'content-library',
    label: 'Content Library',
    icon: Folder02Icon,
    to: '/content-library',
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
 * The badge's accessible name and `title`. A mixed assignment reads
 * _"2 of 5 assigned to you"_; a plain count names what is being counted.
 */
export function badgeAccessibleName(count: number, assignedToMe?: number): string {
  const reviews = count === 1 ? 'review' : 'reviews'
  if (typeof assignedToMe === 'number') {
    return `${assignedToMe} of ${count} open ${reviews} assigned to you`
  }
  return `${count} open ${reviews} awaiting review`
}
