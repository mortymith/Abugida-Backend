/**
 * @module core/authorize
 *
 * Organization authorization, shared by every Abugida app.
 *
 * Better Auth's organization plugin owns the tables; this module owns the one
 * question both apps keep asking: *may this session act on this organization,
 * and with what role?* Answers come from the caller's own `member` rows, so a
 * session can never reach an organization it does not belong to — including
 * when the requested id is not the session's active organization.
 *
 * Reads go through the injected Drizzle handle rather than the plugin's
 * admin-only endpoints (`listMembers`), so a plain member can be authorized
 * without a second round trip through the network.
 */

// Drizzle operators come from `@abugida/database` rather than a local
// drizzle-orm import, so the columns and the `eq(...)` helper always come from
// the same drizzle-orm installation.
import { eq } from '@abugida/database'
import { member } from '@abugida/database/auth'
import type { ResolvedSession } from './session'
import type { AuthResult } from './types'
import { err, ok } from './types'
import {
  ROLE_PRIORITY,
  hasAtLeastRole,
  mapBetterAuthRoleToPlatformRole,
  type PlatformRole,
} from './roles'

/**
 * Structural view of the Drizzle query builder this module needs. Declared
 * structurally so the package stays driver-agnostic: any Drizzle instance
 * (node-postgres, PGlite, Bun's driver, …) satisfies it.
 */
export interface MembershipStore {
  select: (fields: Record<string, unknown>) => {
    from: (table: unknown) => {
      where: (condition: unknown) => PromiseLike<Array<Record<string, unknown>>>
    }
  }
}

/** The resolved authorization context for one request. */
export interface OrganizationAccess {
  userId: string
  /** The organization the request is scoped to. */
  organizationId: string
  /** Raw Better Auth member role (`owner`, `admin`, `editor`, …), if any. */
  role: string | null
  /** `role` translated into the shared platform role vocabulary. */
  platformRole: PlatformRole
  /** Whether the scoped organization is the session's active one. */
  active: boolean
}

export interface OrganizationAccessOptions {
  /**
   * Organization to authorize against. Defaults to the session's active
   * organization. Passing an explicit id is what prevents cross-tenant reads:
   * the id is matched against the caller's memberships, never trusted.
   */
  organizationId?: string
}

/**
 * The session's active organization, or `null` when the user has not picked
 * one (or has no memberships). The organization plugin writes this onto the
 * session row when `/auth/organization/set-active` is called.
 */
export function activeOrganizationId(session: ResolvedSession | null | undefined): string | null {
  return session?.session.activeOrganizationId ?? null
}

function toMembershipStore(db: unknown): MembershipStore {
  return db as MembershipStore
}

/** Every membership row of one user, keyed by organization. */
async function membershipsFor(db: unknown, userId: string): Promise<Map<string, string>> {
  const store = toMembershipStore(db)
  const rows = await store
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, userId))

  const memberships = new Map<string, string>()
  for (const row of rows) {
    const organizationId = row.organizationId
    if (typeof organizationId === 'string') memberships.set(organizationId, String(row.role ?? ''))
  }
  return memberships
}

/**
 * Resolve the caller's access to an organization.
 *
 * Fails with `unauthorized` when there is no session, and with `forbidden`
 * when the caller is not a member of the requested organization — including
 * the case where the id differs from the session's active organization, which
 * is the cross-tenant case.
 */
export async function resolveOrganizationAccess(
  db: unknown,
  session: ResolvedSession | null,
  options: OrganizationAccessOptions = {},
): Promise<AuthResult<OrganizationAccess>> {
  if (!session) {
    return err({ kind: 'unauthorized', message: 'No active session.' })
  }

  const userId = session.user.id
  const activeId = activeOrganizationId(session)
  const organizationId = options.organizationId ?? activeId

  if (!organizationId) {
    return err({
      kind: 'forbidden',
      message: 'No active organization. Select an organization and try again.',
    })
  }

  const memberships = await membershipsFor(db, userId)
  const role = memberships.get(organizationId)

  if (role === undefined) {
    return err({
      kind: 'forbidden',
      message: 'You do not have access to this organization.',
    })
  }

  return ok({
    userId,
    organizationId,
    role: role || null,
    platformRole: mapBetterAuthRoleToPlatformRole(role),
    active: organizationId === activeId,
  })
}

export interface RequireOrganizationRoleOptions extends OrganizationAccessOptions {
  /** Minimum platform role required to perform the operation. */
  minimumRole: PlatformRole
}

/**
 * Like {@link resolveOrganizationAccess}, but also requires a minimum role.
 * A member of the wrong role gets `forbidden`, never a partial result.
 */
export async function requireOrganizationRole(
  db: unknown,
  session: ResolvedSession | null,
  options: RequireOrganizationRoleOptions,
): Promise<AuthResult<OrganizationAccess>> {
  const access = await resolveOrganizationAccess(db, session, options)
  if (!access.ok) return access

  if (!hasAtLeastRole(access.value.platformRole, options.minimumRole)) {
    return err({
      kind: 'forbidden',
      message: `This action requires the ${options.minimumRole} role.`,
    })
  }

  return access
}

/**
 * The most privileged platform role a user holds across all of their
 * organizations. Used for app-wide capability checks (e.g. "may open revenue
 * analytics") where the active organization is not the right scope.
 *
 * Takes a user id rather than a session because every caller has one; pass
 * `null` for an anonymous caller, which resolves to the least-privileged
 * role.
 */
export async function resolveUserPlatformRole(
  db: unknown,
  userId: string | null,
): Promise<PlatformRole> {
  if (!userId) return 'viewer'
  const memberships = await membershipsFor(db, userId)

  let best: PlatformRole = 'viewer'
  for (const role of memberships.values()) {
    const candidate = mapBetterAuthRoleToPlatformRole(role)
    if (ROLE_PRIORITY[candidate] > ROLE_PRIORITY[best]) best = candidate
  }
  return best
}
