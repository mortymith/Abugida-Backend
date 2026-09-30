/**
 * Platform roles (spec 11 Roles & Permissions matrix).
 *
 * The role vocabulary itself — which Better Auth member roles map onto which
 * platform role, and how they are ordered — is owned by `@abugida/auth` so the
 * API and the dashboard cannot disagree about what a `member` row grants. It
 * is re-exported here because that is where feature code imports it from.
 *
 * What stays in the dashboard is the *product* matrix: which platform roles
 * may open which screen. Pure module (no db, no env) so both server and client
 * code — and unit tests — can import it safely.
 */
import {
  hasAtLeastRole,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
  PLATFORM_ROLES,
  ROLE_PRIORITY,
} from '@abugida/auth/roles'
import type { PlatformRole } from '@abugida/auth/roles'

export {
  hasAtLeastRole,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
  PLATFORM_ROLES,
  ROLE_PRIORITY,
}
export type { PlatformRole }

/** Roles allowed to open Revenue Analytics (S-1.2) and see revenue figures. */
export const REVENUE_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/** Roles allowed to author/edit course content (spec 04 authoring screens). */
export const COURSE_AUTHORING_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/** Roles allowed to open the Review & Approval Queue (S-2.14). */
export const REVIEW_DECISION_ROLES: readonly PlatformRole[] = ['admin', 'reviewer']
