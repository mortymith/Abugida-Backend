/**
 * @module context
 *
 * The tenant context and the membership/permission checks that produce it.
 *
 * A tenant context is only ever built here, and only ever from a *verified
 * membership*: a hostname resolves a candidate tenant, authentication
 * identifies the caller, and a `member` row decides whether the two belong
 * together. Any of the three missing means no context — never a partial one.
 *
 *   hostname → resolve tenant → authenticate → verify membership → authorize
 *             → TenantContext
 *
 * The reads go through an injected {@link TenantStore}, so this module has no
 * database dependency and no framework. `@abugida/tenant/store` supplies the
 * Drizzle-backed implementation; the tables themselves stay owned by
 * `@abugida/database` and their writes stay owned by Better Auth's
 * organization plugin.
 */

import { mapBetterAuthRoleToPlatformRole } from '@abugida/auth/roles'
import {
  TenantMembershipError,
  TenantNotFoundError,
  TenantPermissionError,
  TenantUnauthenticatedError,
} from './errors'
import { roleHasPermission, type TenantPermission, type TenantRole } from './permissions'

/** A tenant workspace: the Abugida organization, projected onto what apps need. */
export interface Tenant {
  id: string
  slug: string
  name: string
}

/** One user's membership of one tenant, as stored by Better Auth. */
export interface TenantMembership {
  id: string
  tenantId: string
  userId: string
  /** Raw Better Auth member role (`owner`, `admin`, `editor`, …). */
  role: string | null
}

/**
 * The read side of tenancy. Implemented once over Drizzle in
 * `@abugida/tenant/store`; injectable so apps and tests can supply their own.
 */
export interface TenantStore {
  findTenantBySlug(slug: string): Promise<Tenant | null>
  findTenantById(tenantId: string): Promise<Tenant | null>
  findMembership(input: { tenantId: string; userId: string }): Promise<TenantMembership | null>
}

/**
 * The authorized, tenant-scoped identity of one request.
 *
 * Every field is established by a check, none by the client: `tenantId` and
 * `slug` come from the hostname lookup, `userId` from the session, and
 * `membershipId`/`role` from the membership row.
 */
export interface TenantContext {
  tenantId: string
  slug: string
  tenantName: string
  userId: string
  membershipId: string
  role: TenantRole
  /** The raw Better Auth role behind `role`, for display and auditing. */
  rawRole: string | null
}

/** Maps a raw member role onto the tenant role it grants. */
export function toTenantRole(rawRole: string | null | undefined): TenantRole {
  return mapBetterAuthRoleToPlatformRole(rawRole)
}

export interface TenantMembershipRequest {
  store: TenantStore
  /** The tenant the request resolved to (from the hostname or an explicit id). */
  tenant: Tenant | { id: string; slug?: string; name?: string }
  /** The authenticated caller, or `null` for an anonymous request. */
  userId: string | null | undefined
  /** Optional: expected slug, so a store returning a mismatched row is caught. */
  expectSlug?: string
}

/**
 * Verify that `userId` is a member of `tenant` and return the resulting
 * context.
 *
 * Throws {@link TenantUnauthenticatedError} for an anonymous caller,
 * {@link TenantMembershipError} for a non-member (this is the cross-tenant
 * case) and {@link TenantNotFoundError} for a tenant that does not exist. It
 * never returns a context with a missing or guessed field.
 */
export async function requireTenantMembership(
  request: TenantMembershipRequest,
): Promise<TenantContext> {
  const { store, tenant, userId } = request
  if (!userId) throw new TenantUnauthenticatedError()

  const membership = await store.findMembership({ tenantId: tenant.id, userId })
  if (!membership) throw new TenantMembershipError()

  // Defence in depth: a store that answered about a different tenant than the
  // one requested must not be able to authorize the request.
  if (membership.tenantId !== tenant.id) throw new TenantMembershipError()
  if (membership.userId !== userId) throw new TenantMembershipError()

  return {
    tenantId: tenant.id,
    slug: tenant.slug ?? '',
    tenantName: tenant.name ?? '',
    userId,
    membershipId: membership.id,
    role: toTenantRole(membership.role),
    rawRole: membership.role,
  }
}

/**
 * The full path: resolve the tenant by slug, then verify membership. The
 * unknown-tenant and not-a-member cases stay distinct so a route can answer 404
 * versus 403.
 */
export async function requireTenantContextBySlug(input: {
  store: TenantStore
  slug: string
  userId: string | null | undefined
}): Promise<TenantContext> {
  const tenant = await input.store.findTenantBySlug(input.slug)
  if (!tenant) throw new TenantNotFoundError()
  return requireTenantMembership({ store: input.store, tenant, userId: input.userId })
}

/** Whether a context's role grants a permission. */
export function hasTenantPermission(
  subject: TenantContext | TenantRole,
  permission: TenantPermission,
): boolean {
  const role = typeof subject === 'string' ? subject : subject.role
  return roleHasPermission(role, permission)
}

/**
 * Security boundary: return the context when the permission is granted, throw
 * {@link TenantPermissionError} when it is not.
 *
 * Use this in the API. Dashboard code may call {@link hasTenantPermission} to
 * hide a control, but that is UX and is never the enforcement point.
 */
export function requireTenantPermission<T extends TenantContext | TenantRole>(
  subject: T,
  permission: TenantPermission,
): T {
  if (!hasTenantPermission(subject, permission)) throw new TenantPermissionError(permission)
  return subject
}

/**
 * Reject a resource id that belongs to another tenant.
 *
 * A client may name `organizationId` in a body or a query string; that value is
 * a claim, not an authorization. Comparing it against the established context
 * is what stops a member of Organization A from reading Organization B's rows
 * by editing a parameter.
 */
export function requireSameTenant(
  context: TenantContext,
  tenantId: string | null | undefined,
): void {
  if (!tenantId) return
  if (tenantId !== context.tenantId) throw new TenantMembershipError()
}
