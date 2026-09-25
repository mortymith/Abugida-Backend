/**
 * Platform roles (spec 11 Roles & Permissions matrix).
 *
 * Roles are stored as Better Auth organization member roles. Better Auth's
 * built-in roles (`owner`, `admin`, `member`) are mapped onto the four
 * platform roles; `editor`, `viewer`, and `support` are used verbatim.
 *
 * This module is pure (no db, no env) so both server and client code — and
 * unit tests — can import it safely.
 */
export const PLATFORM_ROLES = ['admin', 'editor', 'reviewer', 'support', 'viewer'] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/**
 * Higher wins when a user holds several org memberships. `owner` outranks
 * `admin`; the rest follow the privilege order of the permissions matrix
 * (spec 11): Reviewer approves but cannot author; Support views students
 * and comms; Viewer is read-only.
 */
export const ROLE_PRIORITY: Record<PlatformRole, number> = {
  admin: 5,
  editor: 4,
  reviewer: 3,
  support: 2,
  viewer: 1,
}

/** Roles allowed to open Revenue Analytics (S-1.2) and see revenue figures. */
export const REVENUE_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/** Roles allowed to author/edit course content (spec 04 authoring screens). */
export const COURSE_AUTHORING_ROLES: readonly PlatformRole[] = ['admin', 'editor']

/** Roles allowed to open the Review & Approval Queue (S-2.14). */
export const REVIEW_DECISION_ROLES: readonly PlatformRole[] = ['admin', 'reviewer']

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === 'string' && (PLATFORM_ROLES as readonly string[]).includes(value)
}

/**
 * Map a raw Better Auth member role (single role or comma-separated list) to
 * the platform role it grants. Unknown roles fall back to the least-privileged
 * `viewer`, mirroring the sidebar's previous default.
 */
export function mapBetterAuthRoleToPlatformRole(raw: string | null | undefined): PlatformRole {
  if (!raw) return 'viewer'

  const parts = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  let best: PlatformRole = 'viewer'
  for (const part of parts) {
    const candidate: PlatformRole =
      part === 'owner' || part === 'admin' ? 'admin' : isPlatformRole(part) ? part : 'viewer'
    if (ROLE_PRIORITY[candidate] > ROLE_PRIORITY[best]) best = candidate
  }
  return best
}

export function hasAtLeastRole(role: PlatformRole, minimum: PlatformRole): boolean {
  return ROLE_PRIORITY[role] >= ROLE_PRIORITY[minimum]
}
