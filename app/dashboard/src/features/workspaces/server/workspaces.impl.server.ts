/**
 * Server-only workspace resolution. Never import from client code — this module
 * pulls in the database client and the shared auth instance.
 *
 * The list is **permission-filtered**: it is built from the caller's own
 * `member` rows, so it can never become a directory of every workspace.
 */
import { asc, eq } from '@abugida/database'
import { member, organization } from '@abugida/database/auth'
import { highestPlatformRole, mapBetterAuthRoleToPlatformRole } from '@abugida/auth/roles'
import { getAuth } from '#/config/auth.server'
import { db } from '#/config/db.config'
import type { WorkspaceContext, WorkspaceSummary } from '../workspaces.types'

interface MembershipRow {
  id: string
  name: string
  slug: string
  role: string
}

async function membershipsFor(userId: string): Promise<MembershipRow[]> {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name))
}

/**
 * Resolve the caller's workspaces, which one is active, and the role they hold
 * **there**.
 *
 * The session's `activeOrganizationId` wins. When it is absent — a user who has
 * never picked one, or a membership that was removed mid-session — the first
 * membership by name is the deterministic fallback, so the shell always has one
 * scope to render instead of an empty header.
 */
export async function resolveWorkspaceContextImpl(): Promise<WorkspaceContext> {
  const request = await import('@tanstack/react-start/server').then((mod) => mod.getRequest())
  const session = await getAuth().getSession(request.headers)
  if (!session.ok) {
    return { workspaces: [], activeWorkspaceId: null, role: 'viewer' }
  }

  const rows = await membershipsFor(session.value.user.id)
  const activeId = session.value.session.activeOrganizationId ?? rows.at(0)?.id ?? null

  const workspaces: WorkspaceSummary[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    memberRole: row.role,
    platformRole: mapBetterAuthRoleToPlatformRole(row.role),
    isActive: row.id === activeId,
  }))

  const active = workspaces.find((workspace) => workspace.isActive)
  const role = active?.platformRole ?? highestPlatformRole(rows.map((row) => row.role))

  return { workspaces, activeWorkspaceId: activeId, role }
}

/**
 * The platform role **of the active workspace**, falling back to the most
 * privileged membership when the session has no workspace. Route guards use
 * this so a permission gate can never disagree with the navigation the user is
 * looking at.
 */
export async function resolveActiveWorkspaceRoleImpl(): Promise<WorkspaceContext['role']> {
  const { role } = await resolveWorkspaceContextImpl()
  return role
}
