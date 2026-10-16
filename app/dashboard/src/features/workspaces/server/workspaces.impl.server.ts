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
 * The active workspace's id, or a throw.
 *
 * This is the tenancy boundary for every workspace-scoped read (courses, assets,
 * search). It throws instead of returning `null` on purpose: a read with no
 * workspace must fail as the 403 case in spec 11, never quietly continue
 * unfiltered and read every workspace's rows.
 */
export async function requireActiveOrganizationIdImpl(): Promise<string> {
  const { workspaces, activeWorkspaceId } = await resolveWorkspaceContextImpl()
  const fallbackId = activeWorkspaceId ?? workspaces.at(0)?.id ?? null
  if (!fallbackId) {
    throw new Error('NO_ACTIVE_WORKSPACE')
  }
  // Guard against a stale/removed activeOrganizationId on the session: if the
  // active id no longer matches a real membership, fall back to the first one
  // instead of turning every workspace-scoped read into a 403.
  if (!workspaces.some((workspace) => workspace.id === fallbackId)) {
    const first = workspaces.at(0)?.id
    if (!first) throw new Error('NO_ACTIVE_WORKSPACE')
    return first
  }
  return fallbackId
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

/**
 * Spec 12 § 12.0 — the Markdown rollout gate.
 *
 * Returns `true` when the active workspace has been enrolled in Markdown writes.
 * Defaults to `false` (the column's NOT NULL default) so the rollout is opt-in
 * per workspace and a rollback is a flag flip rather than a deploy-revert. This
 * is the single load-bearing piece that makes the § 12.0 flag-state matrix
 * work: with the flag off, `saveLesson` writes the legacy HTML serialization
 * and dual hydration (§ 5.2) keeps every row readable regardless of which side
 * of step 5/7 the workspace is on.
 */
export async function isMarkdownWritesEnabledImpl(): Promise<boolean> {
  const orgId = await requireActiveOrganizationIdImpl()
  const rows = await db
    .select({ enabled: organization.markdownWritesEnabled })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  return rows.at(0)?.enabled === true
}
