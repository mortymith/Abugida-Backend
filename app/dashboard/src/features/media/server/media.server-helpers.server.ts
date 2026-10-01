/**
 * Server-only helpers for the media feature impl modules: session/role
 * requirements (spec 11 matrix: Admin/Editor write, Reviewer/Viewer read).
 * Never import from client code.
 */
import { getRequest } from '@tanstack/react-start/server'
import { getAuth } from '#/config/auth.server'
import { COURSE_AUTHORING_ROLES } from '#/features/auth/auth.roles'
import { resolvePlatformRoleImpl } from '#/features/auth/server/auth.roles.impl.server'
import type { PlatformRole } from '#/features/auth/auth.roles'

export async function requireUserId(): Promise<string> {
  const request = getRequest()
  const session = await getAuth().getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return session.value.user.id
}

export async function getSessionRole(): Promise<PlatformRole> {
  const request = getRequest()
  const session = await getAuth().getSession(request.headers)
  if (!session.ok) return 'viewer'
  return resolvePlatformRoleImpl(session.value.user.id)
}

/**
 * Media write surface (S-3.2 upload, S-3.3 edit/delete, S-3.4 folders,
 * S-3.6 transcription authoring): admin/editor only. Reviewer/Viewer are
 * read-only; Support has no access to the module at all.
 */
export async function requireLibraryWriteRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!COURSE_AUTHORING_ROLES.includes(role)) throw new Error('FORBIDDEN')
  return userId
}

/**
 * The workspace every media read and write is scoped to (spec 13).
 *
 * Shares the courses helper so the Media and the Course Catalog
 * cannot drift on the tenancy rule; both throw rather than reading unfiltered.
 */
export async function requireActiveOrganizationId(): Promise<string> {
  const { requireActiveOrganizationIdImpl } =
    await import('#/features/workspaces/server/workspaces.impl.server')
  return requireActiveOrganizationIdImpl()
}

/** Escape user text for LIKE/ILIKE patterns (no wildcard injection). */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}
