import {
  DashboardCircleIcon,
  Book01Icon,
  Folder02Icon,
  StudentsIcon,
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
    roles: ['admin', 'editor', 'viewer'],
  },
  {
    id: 'content-library',
    label: 'Content Library',
    icon: Folder02Icon,
    to: '/content-library',
    roles: ['admin', 'editor'],
  },
  {
    id: 'students',
    label: 'Students',
    icon: StudentsIcon,
    to: '/students',
    roles: ['admin', 'editor', 'support'],
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
