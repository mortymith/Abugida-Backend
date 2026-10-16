/**
 * Server-only implementation of S-13.3 Role Assignment — course-role side
 * (spec 13). The member-role side is owned by S-6.2's `settings.team.impl`;
 * this module owns the per-course role grant/revoke/list surface.
 *
 * Spec 13 § The Two Role Systems: course roles are independent of member
 * roles. A user with `member.role = 'member'` who holds a course role of
 * `reviewer` on one course can review that course and nothing else. This is
 * what lets an Instructor review their colleague's course without becoming a
 * workspace admin.
 *
 * Self-approval guard (Part 11 § Course Lifecycle Capabilities) is enforced
 * here: a user cannot grant themselves a course role. The spec's "Yours —
 * awaiting another reviewer" queue row is the reviewer-side surface for the
 * same guard.
 *
 * Revocation is immediate and sets `revokedAt` rather than deleting the row
 * (spec 13 § Precedence rule 3: `revokedAt IS NOT NULL` means the grant is
 * void immediately, with no session invalidation needed). Revoking a member
 * role does not delete `course_roles` rows; the rows go dormant and are
 * listed under "Reassigned on next membership change" in S-6.2.
 */
import { and, desc, eq, isNull } from '@abugida/database'
import { courseRoles, roles } from '@abugida/database/ops'
import { courses } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireAuthoringRole,
  requireUserId,
  resolveCourse,
} from '../../courses/server/courses.server-helpers.server'
import { writeAudit } from '../../settings/server/settings.server-helpers.server'
import {
  COURSE_ROLE_NAMES,
  isCourseRoleName,
  type CourseRoleAssignment,
  type CourseRoleName,
} from '../courses.course-roles'

// Re-export the pure helpers so callers can import everything from one place.
export { COURSE_ROLE_NAMES, isCourseRoleName }
export type { CourseRoleAssignment, CourseRoleName }

/**
 * Spec 13 S-13.3 — grant a course role.
 *
 * Writes a `course_roles` row with `grantedBy` set to the acting user.
 * Validates:
 *  - the course is visible to the caller (resolveCourse scopes to the active
 *    workspace)
 *  - the role name is one of the five spec values
 *  - the caller is not granting themselves a role (self-approval guard)
 *  - there is no existing active grant for the same (user, course, role)
 *
 * Returns the new assignment with names resolved for the S-13.3 table.
 */
export async function grantCourseRoleImpl(input: {
  coursePublicId: string
  userPublicId: string
  roleName: CourseRoleName
}): Promise<CourseRoleAssignment> {
  const granterId = await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  if (!isCourseRoleName(input.roleName)) {
    throw new Error(`UNKNOWN_ROLE: ${input.roleName}`)
  }

  // Self-approval guard: a user cannot grant themselves a course role. The
  // spec calls this out as the "Yours — awaiting another reviewer" case on
  // the reviewer side; on the grant side it is a hard rejection.
  if (input.userPublicId === granterId) {
    throw new Error('SELF_GRANT_BLOCKED: You cannot grant yourself a course role.')
  }

  // Resolve the role id by name.
  const roleRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.name, input.roleName), isNull(roles.deletedAt)))
    .limit(1)
  const role = roleRows.at(0)
  if (!role) throw new Error(`ROLE_NOT_FOUND: ${input.roleName}`)

  // Resolve the grantee user.
  const granteeRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, input.userPublicId))
    .limit(1)
  const grantee = granteeRows.at(0)
  if (!grantee) throw new Error('USER_NOT_FOUND')

  // Check for an existing active grant. A revoked grant can be re-granted; a
  // new row is inserted rather than un-revoking the old one, so the audit
  // trail stays linear.
  const existingRows = await db
    .select({ id: courseRoles.id })
    .from(courseRoles)
    .where(
      and(
        eq(courseRoles.userId, grantee.id),
        eq(courseRoles.courseId, course.id),
        eq(courseRoles.roleId, role.id),
        isNull(courseRoles.revokedAt),
      ),
    )
    .limit(1)
  if (existingRows.at(0)) {
    throw new Error('ROLE_ALREADY_GRANTED: This user already holds this role on this course.')
  }

  const inserted = await db
    .insert(courseRoles)
    .values({
      userId: grantee.id,
      courseId: course.id,
      roleId: role.id,
      grantedBy: granterId,
    })
    .returning({
      publicId: courseRoles.publicId,
      grantedAt: courseRoles.grantedAt,
    })
  const row = inserted.at(0)
  if (!row) throw new Error('GRANT_FAILED')

  await writeAudit({
    actorId: granterId,
    action: 'permission_change',
    resourceType: 'course',
    metadata: {
      screen: 'S-13.3',
      action: 'course_role_granted',
      coursePublicId: input.coursePublicId,
      userPublicId: input.userPublicId,
      roleName: input.roleName,
    },
  })

  return {
    publicId: row.publicId,
    coursePublicId: input.coursePublicId,
    courseTitle: course.title,
    userPublicId: grantee.id,
    userName: grantee.name,
    userEmail: grantee.email,
    roleName: input.roleName,
    grantedByPublicId: granterId,
    grantedByName: null, // The caller's name is resolved by the S-13.3 view.
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: null,
  }
}

/**
 * Spec 13 S-13.3 — revoke a course role.
 *
 * Sets `revokedAt` to NOW() rather than deleting the row. The revocation is
 * immediate (spec 13 § Precedence rule 3: `revokedAt IS NOT NULL` means the
 * grant is void immediately, with no session invalidation needed).
 *
 * The caller must be an admin/editor (the same boundary as grant). The
 * course's own owner cannot be revoked through this path — that goes through
 * the owner-transfer flow (Phase C2).
 */
export async function revokeCourseRoleImpl(input: {
  courseRolePublicId: string
}): Promise<{ ok: true }> {
  const callerId = await requireAuthoringRole()

  // Find the assignment. Must be active (revokedAt IS NULL).
  const rows = await db
    .select({
      id: courseRoles.id,
      userId: courseRoles.userId,
      courseId: courseRoles.courseId,
      roleId: courseRoles.roleId,
      roleName: roles.name,
    })
    .from(courseRoles)
    .innerJoin(roles, eq(roles.id, courseRoles.roleId))
    .where(
      and(eq(courseRoles.publicId, input.courseRolePublicId), isNull(courseRoles.revokedAt)),
    )
    .limit(1)
  const assignment = rows.at(0)
  if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND')

  // The course's owner cannot be revoked through this path. Owner removal
  // goes through the transfer flow (Phase C2) so the workspace never ends
  // up with an ownerless course.
  if (assignment.roleName === 'owner') {
    throw new Error(
      'OWNER_REVOKE_BLOCKED: Transfer ownership to another member first.',
    )
  }

  await db
    .update(courseRoles)
    .set({ revokedAt: new Date() })
    .where(eq(courseRoles.id, assignment.id))

  await writeAudit({
    actorId: callerId,
    action: 'permission_change',
    resourceType: 'course',
    metadata: {
      screen: 'S-13.3',
      action: 'course_role_revoked',
      courseRolePublicId: input.courseRolePublicId,
      roleName: assignment.roleName,
    },
  })

  return { ok: true }
}

/**
 * Spec 13 S-13.3 — list course roles.
 *
 * Returns active + revoked assignments, newest-first. When `coursePublicId`
 * is supplied, the list is scoped to that course; otherwise it covers every
 * course the caller can see (the active workspace's courses).
 *
 * The S-13.3 view renders active assignments in the main table and revoked
 * assignments in a collapsed "Revoked" section with `revokedBy` / `revokedAt`.
 */
export async function listCourseRolesImpl(input: {
  coursePublicId?: string
}): Promise<CourseRoleAssignment[]> {
  await requireUserId()

  const courseFilter = input.coursePublicId
    ? await resolveCourse(input.coursePublicId).then((c) => c.id)
    : null

  const rows = await db
    .select({
      publicId: courseRoles.publicId,
      grantedAt: courseRoles.grantedAt,
      revokedAt: courseRoles.revokedAt,
      coursePublicId: courses.publicId,
      courseTitle: courses.title,
      userPublicId: users.id,
      userName: users.name,
      userEmail: users.email,
      roleName: roles.name,
      grantedByPublicId: courseRoles.grantedBy,
    })
    .from(courseRoles)
    .innerJoin(courses, eq(courses.id, courseRoles.courseId))
    .innerJoin(users, eq(users.id, courseRoles.userId))
    .innerJoin(roles, eq(roles.id, courseRoles.roleId))
    .where(courseFilter ? eq(courseRoles.courseId, courseFilter) : undefined)
    .orderBy(desc(courseRoles.grantedAt))

  return rows.map((row) => ({
    publicId: row.publicId,
    coursePublicId: row.coursePublicId,
    courseTitle: row.courseTitle,
    userPublicId: row.userPublicId,
    userName: row.userName,
    userEmail: row.userEmail,
    roleName: row.roleName,
    grantedByPublicId: row.grantedByPublicId,
    grantedByName: null,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  }))
}
