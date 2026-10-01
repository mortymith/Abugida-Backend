/**
 * Workspace server function. The heavy lifting lives in
 * `workspaces.impl.server.ts`; the impl is imported inside the handler so this
 * module stays safe for the client bundle.
 */
import { createServerFn } from '@tanstack/react-start'
import type { WorkspaceContext } from '../workspaces.types'

export const getWorkspaceContext = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WorkspaceContext> => {
    const { resolveWorkspaceContextImpl } = await import('./workspaces.impl.server')
    return resolveWorkspaceContextImpl()
  },
)
