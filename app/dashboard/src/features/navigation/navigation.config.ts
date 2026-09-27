import {
  DashboardCircleIcon,
  Book01Icon,
  Folder02Icon,
  StudentsIcon,
  AnalyticsUpIcon,
  MarketingIcon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'

export interface NavItem {
  id: string
  label: string
  icon: typeof DashboardCircleIcon
  to: string
  badge?: number
  roles: string[]
  /** Roles that see a live badge for this item (S-A.1 pending-review badge). */
  badgeFor?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: DashboardCircleIcon,
    to: '/dashboard',
    roles: ['admin', 'editor', 'viewer', 'support'],
  },
  {
    id: 'courses',
    label: 'Courses',
    icon: Book01Icon,
    to: '/courses',
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
    /** Courses nav badge = pending review count (spec S-A.1) — admin/reviewer only. */
    badgeFor: ['admin', 'reviewer'],
  },
  {
    id: 'content-library',
    label: 'Content Library',
    icon: Folder02Icon,
    to: '/content-library',
    // Spec 11: Admin/Editor full; Reviewer/Viewer view-only → nav visible.
    roles: ['admin', 'editor', 'reviewer', 'viewer'],
  },
  {
    id: 'students',
    label: 'Students',
    icon: StudentsIcon,
    to: '/students',
    roles: ['admin', 'editor', 'support'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: AnalyticsUpIcon,
    to: '/analytics',
    // Spec 11 "Dashboard & Analytics": Admin/Editor full; Reviewer/Viewer
    // view-only; Support sees analytics minus revenue → nav visible to all.
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: MarketingIcon,
    to: '/marketing',
    roles: ['admin', 'editor'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings02Icon,
    to: '/settings',
    roles: ['admin'],
  },
]

export function getVisibleNavItems(userRole: string) {
  return NAV_ITEMS.filter((item) => item.roles.includes(userRole))
}
