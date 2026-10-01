/**
 * @module authorization
 *
 * The server-side half of the tenancy layer: tenant context construction and
 * the permission checks over it.
 *
 * Apps import this from `@abugida/tenant/authorization` so a policy check is
 * visibly a policy check at the import site, and so the data access that feeds
 * it (`@abugida/tenant/store`) never lands in a bundle that only needs to
 * compute a link.
 */

export type { Tenant, TenantContext, TenantMembership, TenantStore } from './context'
export {
  requireTenantMembership,
  requireTenantContextBySlug,
  requireTenantPermission,
  requireSameTenant,
  hasTenantPermission,
  toTenantRole,
} from './context'
export type { TenantMembershipRequest } from './context'

export { TENANT_PERMISSIONS, TENANT_ROLE_PERMISSIONS, listTenantPermissions } from './permissions'
export { roleHasPermission } from './permissions'
export type { TenantPermission, TenantRole } from './permissions'

export {
  TenantError,
  TenantConfigError,
  TenantMembershipError,
  TenantNotFoundError,
  TenantPermissionError,
  TenantSlugError,
  TenantUnauthenticatedError,
} from './errors'
