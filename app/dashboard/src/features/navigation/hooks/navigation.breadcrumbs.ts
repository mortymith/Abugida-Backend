import { useMatches, useRouterState } from '@tanstack/react-router'

interface Breadcrumb {
  label: string
  to?: string
  isCurrent: boolean
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  courses: 'Courses',
  'content-library': 'Content Library',
  students: 'Students',
  marketing: 'Marketing',
  settings: 'Settings',
}

export function useBreadcrumbs(): Breadcrumb[] {
  const matches = useMatches()
  const routerState = useRouterState()

  const crumbs: Breadcrumb[] = [{ label: 'Home', to: '/dashboard', isCurrent: false }]

  for (const match of matches) {
    const routeId = match.routeId
    if (routeId === '__root__' || routeId === '/_app') continue

    // Extract the segment after /_app/
    const segment = routeId.replace('/_app/', '').replace('/_app', '')
    if (!segment || segment.startsWith('__')) continue

    const label = ROUTE_LABELS[segment]
    if (!label) continue

    const isCurrent = routerState.location.pathname === match.pathname
    crumbs.push({
      label,
      to: isCurrent ? undefined : match.pathname,
      isCurrent,
    })
  }

  return crumbs
}
