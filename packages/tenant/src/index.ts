/**
 * @module index
 *
 * `@abugida/tenant` — the single source of truth for tenancy in the Abugida
 * monorepo, shared by `app/api` and `app/dashboard`.
 *
 * It owns the *application* level of the stack and nothing else:
 *
 *   hostname  → resolveTenantFromHostname
 *   slug      → normalizeTenantSlug / validateTenantSlug / isReservedTenantSlug
 *   URL       → getTenantUrl
 *   context   → requireTenantMembership → TenantContext
 *   access    → hasTenantPermission / requireTenantPermission
 *
 * `@abugida/database` still owns the schemas (`organization`, `member`) and the
 * migrations, and `@abugida/auth` still owns Better Auth, sessions, OAuth and
 * the organization plugin that writes those rows. This package derives
 * application tenancy semantics from them and adds no second system.
 *
 * Subpaths keep the dependency graph honest:
 *   `@abugida/tenant/url`            URL building only (browser-safe)
 *   `@abugida/tenant/authorization`  context + permission checks
 *   `@abugida/tenant/store`          the Drizzle-backed read store
 *   `@abugida/tenant/hono`           the API middleware
 *   `@abugida/tenant/env`            the environment contract
 */

// Domain model
export type { Tenant, TenantContext, TenantMembership, TenantStore } from './context'
export type { TenantRole, TenantPermission } from './permissions'

// Slugs
export {
  RESERVED_TENANT_SLUGS,
  TENANT_SLUG_MAX_LENGTH,
  TENANT_SLUG_MIN_LENGTH,
  isReservedTenantSlug,
  isValidTenantSlug,
  normalizeTenantSlug,
  slugFromTenantName,
  validateTenantSlug,
} from './slug'
export type { ReservedTenantSlug, TenantSlugFailure, TenantSlugValidation } from './slug'

// Hostname resolution
export { isTenantHostname, normalizeHostname, resolveTenantFromHostname } from './resolve'
export type { TenantDomainConfig, TenantHostResolution } from './resolve'

// URLs
export { DEFAULT_PLATFORM_SUBDOMAIN, getPlatformUrl, getTenantHostname, getTenantUrl } from './url'
export type { TenantUrlConfig } from './url'

// Permissions
export {
  TENANT_PERMISSIONS,
  TENANT_ROLE_PERMISSIONS,
  listTenantPermissions,
  roleHasPermission,
} from './permissions'

// Errors
export {
  TenantConfigError,
  TenantError,
  TenantMembershipError,
  TenantNotFoundError,
  TenantPermissionError,
  TenantSlugError,
  TenantUnauthenticatedError,
} from './errors'

// Environment contract
export { resolveTenantConfig, tenantEnvShape } from './config/env'
export type { TenantEnv } from './config/env'
