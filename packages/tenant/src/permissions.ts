/**
 * @module permissions
 *
 * The minimal tenant-scoped permission vocabulary, expressed in the role
 * vocabulary `@abugida/auth` already owns.
 *
 * Deliberately not a framework: there is no policy engine, no inheritance and
 * no per-resource rules. A tenant role maps to a fixed set of permissions, and
 * that is the whole model. New permissions are added here when a feature
 * actually needs one.
 *
 * Tenant roles and platform roles are the same vocabulary but different
 * questions: a *platform* role answers "what may this user do across
 * Abugida", a *tenant* role answers "what may this user do inside this
 * organization". Both are derived from the same Better Auth `member.role` row,
 * so the two can never disagree about a given membership.
 */

import type { PlatformRole } from '@abugida/auth/roles'

/** A tenant role: the shared Abugida role vocabulary, as held inside a tenant. */
export type TenantRole = PlatformRole

/** Operations a tenant-scoped caller may be authorized for. */
export const TENANT_PERMISSIONS = [
  'organization:read',
  'organization:manage',
  'course:read',
  'course:create',
  'course:update',
  'course:delete',
  'student:read',
  'student:manage',
] as const

export type TenantPermission = (typeof TENANT_PERMISSIONS)[number]

const READ_ONLY: readonly TenantPermission[] = ['organization:read', 'course:read', 'student:read']

/**
 * What each tenant role grants. The ordering of the platform roles is the
 * privilege order `@abugida/auth` documents, so this table is monotone: a more
 * privileged role never holds fewer permissions than a less privileged one.
 */
export const TENANT_ROLE_PERMISSIONS: Record<TenantRole, readonly TenantPermission[]> = {
  // Full control of the workspace, including destructive course operations.
  admin: [...TENANT_PERMISSIONS],
  // Authors course content; does not delete courses or manage the org.
  editor: [...READ_ONLY, 'course:create', 'course:update', 'student:manage'],
  // Approves and annotates content; cannot author.
  reviewer: [...READ_ONLY, 'course:update'],
  // Serves students: reads and manages them, does not author content.
  support: [...READ_ONLY, 'student:manage'],
  // Read-only.
  viewer: [...READ_ONLY],
}

/** Every permission held by a tenant role. */
export function listTenantPermissions(role: TenantRole): readonly TenantPermission[] {
  return TENANT_ROLE_PERMISSIONS[role] ?? TENANT_ROLE_PERMISSIONS.viewer
}

/** Whether a tenant role grants a permission. Unknown roles grant nothing. */
export function roleHasPermission(role: TenantRole, permission: TenantPermission): boolean {
  return listTenantPermissions(role).includes(permission)
}
