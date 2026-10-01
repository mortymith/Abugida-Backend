import { useRouteContext, useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import { authClient } from '#/lib/auth-client'
import { useRole } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'
import { canSwitchWorkspace } from '../workspaces.types'
import type { WorkspaceContext } from '../workspaces.types'

/** Empty scope — used outside the authenticated layout and while SSR-guarded. */
const NO_WORKSPACES: WorkspaceContext = {
  workspaces: [],
  activeWorkspaceId: null,
  role: 'viewer',
}

/**
 * The workspace scope the shell renders against.
 *
 * Resolved once per navigation by `_app/route.tsx` `beforeLoad`, so the
 * navigation is rebuilt from the **active workspace's** grants and never merges
 * a second workspace's role into the first.
 */
export function useWorkspaceContext(): WorkspaceContext {
  const context = useRouteContext({ strict: false })
  return (context as { workspace?: WorkspaceContext }).workspace ?? NO_WORKSPACES
}

/**
 * The active workspace's role.
 *
 * Delegates to `useRole()` on purpose: `_app/route.tsx` puts the *same* value in
 * both places, and one accessor means a route guard and the navigation can never
 * read two different roles. The workspace-specific data (name, slug, the list to
 * switch between) comes from `useWorkspaceContext()`.
 */
export function useWorkspaceRole(): PlatformRole {
  return useRole()
}

/**
 * Switch the active workspace.
 *
 * The change is a **session** change (`setActive`), not a URL change, so every
 * screen has to re-read: the router is invalidated so `beforeLoad` re-resolves
 * the role for the new scope, and cached queries are refetched so no screen can
 * show data fetched under the previous workspace.
 *
 * Switching needs a connection — the session cookie has to be reissued — so it
 * is **disabled with a reason** while offline rather than failing silently
 * (S-13.2, spec 11 case 2).
 */
export function useSwitchWorkspace() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await authClient.organization.setActive({ organizationId })
      if (error) throw new Error(error.message ?? 'We could not switch workspaces.')
      return organizationId
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      await router.invalidate()
      toast.success('Switched workspace. Every screen now shows the new workspace’s data.')
    },
    onError: (cause) =>
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'We couldn’t switch workspaces — you’re still here.',
      ),
  })
}

export { canSwitchWorkspace }
