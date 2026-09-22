/**
 * Server-only helpers shared by the Students feature impl modules (spec 06):
 * role requirements per the spec 11 matrix, student/course/cohort resolution,
 * enrollment creation, and staff fan-out. Never import from client code.
 */
import { and, eq, isNull, sql } from '@abugida/database'
import { courses } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { member, users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import {
  hasAtLeastRole,
  mapBetterAuthRoleToPlatformRole,
  PLATFORM_ROLES,
} from '#/features/auth/auth.roles'
import type { PlatformRole } from '#/features/auth/auth.roles'
import { escapeLike as sharedEscapeLike } from '#/features/courses/server/courses.server-helpers.server'

export { escapeLike } from '#/features/courses/server/courses.server-helpers.server'
export { createNotifications } from '#/features/courses/server/courses.server-helpers.server'
export { userIdsWithPlatformRoles } from '#/features/courses/server/courses.server-helpers.server'

export async function requireUserId(): Promise<string> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return session.value.user.id
}

export async function getSessionRole(): Promise<PlatformRole> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) return 'viewer'
  const { resolvePlatformRoleImpl } = await import('#/features/auth/server/auth.roles.impl.server')
  return resolvePlatformRoleImpl(session.value.user.id)
}

/**
 * Student data is sensitive: every Students surface requires at least the
 * lowest staff role (viewer), i.e. any authenticated platform member.
 */
export async function requireStudentReadRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!hasAtLeastRole(role, 'viewer')) throw new Error('FORBIDDEN')
  return userId
}

/** Student write actions (create/edit/enroll/cohorts): admin or editor. */
export async function requireStudentWriteRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!hasAtLeastRole(role, 'editor')) throw new Error('FORBIDDEN')
  return userId
}

/** Messaging Center (S-4.5): admin/support only. */
export async function requireMessagingRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (role !== 'admin' && role !== 'support') throw new Error('FORBIDDEN')
  return userId
}

/** Request decisions (S-4.6): admin, editor, or support. */
export async function requireRequestDecisionRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (role !== 'admin' && role !== 'editor' && role !== 'support') throw new Error('FORBIDDEN')
  return userId
}

/** Directory-wide admin action (account status changes). */
export async function requireAdminRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (role !== 'admin') throw new Error('FORBIDDEN')
  return userId
}

/** Resolve a student (non-deleted user) by id or throw. */
export async function resolveStudent(studentId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, studentId), isNull(users.deletedAt)))
    .limit(1)
  const student = rows.at(0)
  if (!student) throw new Error('STUDENT_NOT_FOUND')
  return student
}

/** Resolve a course by public id or throw. */
export async function resolveCourseByPublicId(coursePublicId: string) {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.publicId, coursePublicId), isNull(courses.deletedAt)))
    .limit(1)
  const course = rows.at(0)
  if (!course) throw new Error('COURSE_NOT_FOUND')
  return course
}

/**
 * Users holding any staff role (organization members) — the directory's
 * "students" population is users WITHOUT one of these memberships.
 */
export async function staffUserIds(): Promise<string[]> {
  const rows = await db.select({ userId: member.userId, role: member.role }).from(member)
  return rows
    .filter((row) => PLATFORM_ROLES.includes(mapBetterAuthRoleToPlatformRole(row.role)))
    .map((row) => row.userId)
}

/**
 * Create an enrollment exactly as manual enrollment does (source
 * `admin_grant`). Caller is responsible for capacity + duplicate checks when
 * batching; this helper enforces the unique (student, course) constraint by
 * pre-checking inside the same transaction it receives.
 */
type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function createEnrollmentInTx(
  tx: Pick<TransactionClient, 'select' | 'insert'>,
  input: { studentId: string; courseId: number },
): Promise<void> {
  const existing = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, input.studentId),
        eq(enrollments.courseId, input.courseId),
        isNull(enrollments.deletedAt),
      ),
    )
    .limit(1)
  if (existing.length > 0) throw new Error('ALREADY_ENROLLED')
  await tx.insert(enrollments).values({
    studentId: input.studentId,
    courseId: input.courseId,
    enrollmentSource: 'admin_grant',
  })
}

/** Count active (non-deleted) enrollments for a course. */
export async function countActiveEnrollments(courseId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), isNull(enrollments.deletedAt)))
  return rows.at(0)?.count ?? 0
}

/** Case-insensitive search pattern from user input (null when blank). */
export function searchPattern(q: string | undefined): string | null {
  const term = q?.trim()
  if (!term) return null
  return `%${sharedEscapeLike(term)}%`
}
