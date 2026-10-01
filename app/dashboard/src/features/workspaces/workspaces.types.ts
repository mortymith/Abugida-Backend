import type { PlatformRole } from '#/features/auth'

/**
 * Workspaces (spec 13 § The Workspace Model).
 *
 * An **organization is a workspace**; the app operates on exactly one at a
 * time, held in the session as `session.activeOrganizationId`. Everything in
 * the shell — the role badge, the navigation, the search scope — is scoped to
 * the *active* workspace, and is rebuilt when it changes.
 */

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
  /** Raw `member.role` as stored — what S-6.2/S-13.3 show and edit. */
  memberRole: string
  /** Platform role this membership grants *in this workspace*. */
  platformRole: PlatformRole
  isActive: boolean
}

export interface WorkspaceContext {
  /** Memberships only — never a directory of every workspace (S-13.2). */
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string | null
  /**
   * The role the shell is built from: the member role **of the active
   * workspace**. It is context, not a property of the user — the same person is
   * an Admin in one workspace and a Reviewer in another.
   */
  role: PlatformRole
}

/**
 * The role pill is **text, never colour** (spec 11 § Status Colour Mapping:
 * purple and the status hues are reserved). Capitalised for display only.
 */
export const WORKSPACE_ROLE_LABELS: Record<PlatformRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  reviewer: 'Reviewer',
  support: 'Support',
  viewer: 'Viewer',
}

export function workspaceRoleLabel(role: PlatformRole): string {
  return WORKSPACE_ROLE_LABELS[role]
}

/**
 * The switcher is **absent** for a single-workspace user — there is nothing to
 * switch to, so it is never a disabled control (S-13.2, spec 11 case 1). The
 * header button and the avatar-menu entry read this same predicate, so the two
 * entry points can never disagree.
 */
export function canSwitchWorkspace(context: WorkspaceContext): boolean {
  return context.workspaces.length > 1
}
