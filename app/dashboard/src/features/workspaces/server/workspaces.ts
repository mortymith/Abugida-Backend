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

/**
 * Spec 12 § 12.0 — read the Markdown rollout flag for the active workspace.
 *
 * Exposed as a server function so the editor's autosave path can decide which
 * serialization to send (`getMarkdown()` vs the legacy HTML path) without
 * duplicating the workspace lookup on the client.
 */
export const isMarkdownWritesEnabled = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const { isMarkdownWritesEnabledImpl } = await import('./workspaces.impl.server')
    return isMarkdownWritesEnabledImpl()
  },
)
