/**
 * @module core/roles
 *
 * The role vocabulary shared by every Abugida app. Pure module: no database,
 * no env, no better-auth — safe to import from server code, client code and
 * tests.
 *
 * Roles are stored as Better Auth organization member roles. Better Auth's
 * built-in roles (`owner`, `admin`, `member`) are mapped onto the five
 * platform roles; `editor`, `reviewer` and `support` are used verbatim.
 * Keeping the mapping here is what stops the API and the dashboard from
 * disagreeing about what a `member` row grants.
 */

export const PLATFORM_ROLES = ['admin', 'editor', 'reviewer', 'support', 'viewer'] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/**
 * Higher wins when a user holds several org memberships. `owner` outranks
 * `admin`; the rest follow the privilege order of the permissions matrix:
 * Reviewer approves but cannot author; Support views students and comms;
 * Viewer is read-only.
 */
export const ROLE_PRIORITY: Record<PlatformRole, number> = {
  admin: 5,
  editor: 4,
  reviewer: 3,
  support: 2,
  viewer: 1,
}

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === 'string' && (PLATFORM_ROLES as readonly string[]).includes(value)
}

/**
 * Map a raw Better Auth member role (single role or comma-separated list) to
 * the platform role it grants. Unknown roles fall back to the
 * least-privileged `viewer`.
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

/** The most privileged platform role granted by a set of raw member roles. */
export function highestPlatformRole(roles: Iterable<string | null | undefined>): PlatformRole {
  let best: PlatformRole = 'viewer'
  for (const role of roles) {
    const candidate = mapBetterAuthRoleToPlatformRole(role)
    if (ROLE_PRIORITY[candidate] > ROLE_PRIORITY[best]) best = candidate
  }
  return best
}

export function hasAtLeastRole(role: PlatformRole, minimum: PlatformRole): boolean {
  return ROLE_PRIORITY[role] >= ROLE_PRIORITY[minimum]
}
