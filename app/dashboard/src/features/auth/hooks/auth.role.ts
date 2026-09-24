import { useRouteContext } from '@tanstack/react-router'
import type { PlatformRole } from '../auth.roles'

/**
 * Read the platform role resolved once per navigation by the `_app` route
 * guard (see routes/_app/route.tsx beforeLoad). Always returns the resolved
 * role while inside the authenticated layout; defaults defensively to
 * `viewer` elsewhere.
 */
export function useRole(): PlatformRole {
  const context = useRouteContext({ strict: false })
  return context.role ?? 'viewer'
}
