import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { WorkspaceConfigView, workspaceConfigQueryOptions } from '#/features/settings'

/**
 * S-13.1 Workspace Configuration (spec 13) — admin only.
 *
 * One screen showing every workspace policy in one place, so an Admin can
 * answer "what is configured here?" without reading five screens and
 * guessing the defaults. Env-set values render read-only with a reason;
 * workspace-configurable values carry a provenance pill.
 */
export const Route = createFileRoute('/_app/settings/workspace-config')({
  beforeLoad: () => requireRolesBeforeLoad(['admin']),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(workspaceConfigQueryOptions()).catch(() => undefined),
  component: WorkspaceConfigView,
})
