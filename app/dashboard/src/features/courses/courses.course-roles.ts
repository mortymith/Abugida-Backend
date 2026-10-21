/**
 * Spec 13 § The Two Role Systems — course-role vocabulary.
 *
 * Pure module: no DB, no env, no framework. Safe to import from server code,
 * client code, and `bun test`. The DB-backed grant/revoke/list impls live in
 * `courses.course-roles.impl.server.ts` and import from here.
 *
 * The `roles.name` column is unique, and these five names are the spec's
 * vocabulary. A grant for an unknown name is rejected at the boundary.
 */
export const COURSE_ROLE_NAMES = ['owner', 'instructor', 'reviewer', 'viewer', 'support'] as const

export type CourseRoleName = (typeof COURSE_ROLE_NAMES)[number]

export function isCourseRoleName(value: string): value is CourseRoleName {
  return (COURSE_ROLE_NAMES as readonly string[]).includes(value)
}

/**
 * One row in the S-13.3 course-roles table, with names resolved. Exported
 * from here so the view + the server fn can share the type without the view
 * pulling in the server impl.
 */
export interface CourseRoleAssignment {
  publicId: string
  coursePublicId: string
  courseTitle: string
  userPublicId: string
  userName: string | null
  userEmail: string | null
  roleName: string
  grantedByPublicId: string | null
  grantedByName: string | null
  grantedAt: string
  revokedAt: string | null
}
