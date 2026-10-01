/**
 * Workspaces — an organization is a workspace (spec 13). The shell renders
 * against exactly one at a time, held in the session.
 */
export {
  WORKSPACE_ROLE_LABELS,
  canSwitchWorkspace,
  workspaceRoleLabel,
  type WorkspaceContext,
  type WorkspaceSummary,
} from './workspaces.types'
export {
  useSwitchWorkspace,
  useWorkspaceContext,
  useWorkspaceRole,
} from './hooks/workspaces.context'
export { getWorkspaceContext } from './server/workspaces'
