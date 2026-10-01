import { useRouterState } from '@tanstack/react-router'
import {
  WORKSPACE_TABS,
  WORKSPACE_TAB_LABELS,
  buildCourseWorkspaceHref,
} from '#/features/courses/courses.workspace'
import type { CourseWorkspaceTab } from '#/features/courses/courses.workspace'
import { useCourseWorkspace } from './navigation.course-workspace'

/**
 * S-A.1 workspace-aware breadcrumbs.
 *
 * Outside a workspace the trail is the module trail (`Courses`,
 * `Media`, …). Inside one it is
 * `Courses / <course title> / <tab>`, and inside the Curriculum tab with an item
 * selected, `Courses / <course> / Curriculum / <item title>`.
 *
 * Two rules from the spec are structural rather than cosmetic, so they live in
 * the data model here:
 *
 * - **Truncation is visual only.** A segment that may be truncated carries the
 *   full value in `fullLabel`, which the renderer puts on both `title` and
 *   `aria-label`; Ge'ez is shorter in characters and wider in glyphs, so no
 *   fixed-px clamp is used and nothing is cut below 40 characters of headroom.
 * - **The tab segment is a disclosure, not a link.** It is a `button` with
 *   `aria-expanded` listing the five workspace destinations, so switching tabs
 *   never requires scrolling back to the nav row or the workspace header.
 */

export interface WorkspaceTabLink {
  to: string
  label: string
  isActive: boolean
}

export interface BreadcrumbCrumb {
  key: string
  label: string
  /** `undefined` on the current crumb — it is text, not a link. */
  to?: string
  isCurrent: boolean
  /** Full value for `title` / `aria-label` when the visible label is truncated. */
  fullLabel?: string
  /** Set on the workspace tab crumb: the five workspace destinations. */
  tabs?: WorkspaceTabLink[]
}

/** Path segment → display label. Unknown segments are humanised, never dropped. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  revenue: 'Revenue',
  courses: 'Courses',
  reviews: 'Review',
  templates: 'Templates',
  new: 'New Course',
  media: 'Media',
  students: 'Students',
  cohorts: 'Cohorts',
  badges: 'Badges',
  messaging: 'Messaging',
  requests: 'Requests',
  rules: 'Rules',
  analytics: 'Analytics',
  marketing: 'Marketing',
  campaigns: 'Campaigns',
  coupons: 'Coupons',
  affiliates: 'Affiliates',
  testimonials: 'Testimonials',
  settings: 'Settings',
  profile: 'My Profile',
  team: 'Team',
  roles: 'Roles & Permissions',
  security: 'Security',
  mfa: 'Two-Factor Authentication',
  billing: 'Billing',
  branding: 'Branding',
  integrations: 'Integrations',
  privacy: 'Privacy & Retention',
  api: 'API & Webhooks',
  search: 'Search',
  notifications: 'Notifications',
}

function humanize(segment: string): string {
  const spaced = segment.replace(/[-_]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * The module trail for a path outside a course workspace. Intermediate crumbs
 * link to the section they name, so a screen is always one click from its
 * module root.
 */
export function buildModuleCrumbs(pathname: string): BreadcrumbCrumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []

  return segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`
    const isCurrent = index === segments.length - 1
    return {
      key: path,
      label: SEGMENT_LABELS[segment] ?? humanize(segment),
      ...(isCurrent ? {} : { to: path }),
      isCurrent,
    }
  })
}

/** The five workspace destinations, as links (S-2.6). */
export function buildWorkspaceTabLinks(
  coursePublicId: string,
  activeTab: CourseWorkspaceTab,
): WorkspaceTabLink[] {
  return WORKSPACE_TABS.map((tab) => ({
    to: buildCourseWorkspaceHref(`/courses/${coursePublicId}`, { tab }),
    label: WORKSPACE_TAB_LABELS[tab],
    isActive: tab === activeTab,
  }))
}

/**
 * `Courses / <course> / <tab> [/ <item>]`.
 *
 * A remembered item that no longer exists is **dropped** rather than rendered as
 * a link to nothing; the same fallback the Resume affordance uses.
 */
export function buildWorkspaceCrumbs(
  workspace: {
    coursePublicId: string
    courseTitle: string
    tab: CourseWorkspaceTab
    itemPublicId?: string
    itemTitle?: string
    itemExists: boolean
    curriculumPending: boolean
  },
  options: { showCoursesCrumb: boolean },
): BreadcrumbCrumb[] {
  const base = `/courses/${workspace.coursePublicId}`
  const crumbs: BreadcrumbCrumb[] = []

  if (options.showCoursesCrumb) {
    crumbs.push({ key: 'courses', label: 'Courses', to: '/courses', isCurrent: false })
  }

  crumbs.push({
    key: `course:${workspace.coursePublicId}`,
    label: workspace.courseTitle,
    fullLabel: workspace.courseTitle,
    to: buildCourseWorkspaceHref(base, { tab: workspace.tab }),
    isCurrent: false,
  })

  const tabLabels = WORKSPACE_TAB_LABELS as Record<string, string>
  crumbs.push({
    key: `tab:${workspace.tab}`,
    label: tabLabels[workspace.tab] ?? humanize(workspace.tab),
    isCurrent: true,
    tabs: buildWorkspaceTabLinks(workspace.coursePublicId, workspace.tab),
  })

  const showItem =
    workspace.itemPublicId != null && (workspace.itemExists || workspace.curriculumPending)

  if (showItem && workspace.itemPublicId) {
    const itemLabel = workspace.itemTitle ?? workspace.itemPublicId
    crumbs.push({
      key: `item:${workspace.itemPublicId}`,
      label: itemLabel,
      fullLabel: itemLabel,
      isCurrent: true,
    })
  }

  return crumbs
}

/**
 * The breadcrumb trail for the current route. Inside the course workspace it is
 * workspace-aware; everywhere else it is the module trail.
 *
 * `canSeeCourses` drops the Courses crumb for a role that has no Courses item,
 * so a deep link never renders a segment the user cannot open.
 */
export function useBreadcrumbs(options: { canSeeCourses: boolean }): BreadcrumbCrumb[] {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const workspace = useCourseWorkspace()

  if (workspace) {
    return buildWorkspaceCrumbs(workspace, { showCoursesCrumb: options.canSeeCourses })
  }
  return buildModuleCrumbs(pathname)
}
