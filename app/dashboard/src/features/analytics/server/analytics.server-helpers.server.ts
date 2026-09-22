/**
 * Server-only helpers shared by the Analytics feature impl modules (spec 07):
 * role requirements per the spec 11 matrix, course/lesson/quiz resolution.
 * Never import from client code.
 */
import { and, eq, isNull } from '@abugida/database'
import { courses, lessons } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { hasAtLeastRole, REVENUE_ROLES } from '#/features/auth/auth.roles'
import type { PlatformRole } from '#/features/auth/auth.roles'
import { resolvePlatformRoleImpl } from '#/features/auth/server/auth.roles.impl.server'

export { pctDelta } from '../analytics.metric-math'

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
  return resolvePlatformRoleImpl(session.value.user.id)
}

/**
 * Analytics read access (S-5.1/S-5.2/S-5.3/S-5.5): every staff role per the
 * spec 11 matrix — Admin/Editor full, Reviewer/Viewer view-only, Support
 * non-revenue. Server-enforced so client UI gating is UX only.
 */
export async function requireAnalyticsReadRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!hasAtLeastRole(role, 'viewer')) throw new Error('FORBIDDEN')
  return userId
}

/** Export Reports (S-5.4): Admin + Editor only per the spec screen roles. */
export async function requireAnalyticsExportRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!hasAtLeastRole(role, 'editor')) throw new Error('FORBIDDEN')
  return userId
}

/** Revenue figures (S-1.2 parity): admin/editor; Support sees no revenue. */
export function canSeeRevenue(role: PlatformRole): boolean {
  return REVENUE_ROLES.includes(role)
}

export class NotFoundError extends Error {
  constructor(message = 'NOT_FOUND') {
    super(message)
    this.name = 'NotFoundError'
  }
}

/** Resolve a course by public ID (any non-deleted status — drafts are analyzable too). */
export async function resolveCourse(coursePublicId: string): Promise<{
  id: number
  publicId: string
  title: string
}> {
  const rows = await db
    .select({ id: courses.id, publicId: courses.publicId, title: courses.title })
    .from(courses)
    .where(and(eq(courses.publicId, coursePublicId), isNull(courses.deletedAt)))
    .limit(1)
  const course = rows.at(0)
  if (!course) throw new NotFoundError('Course not found')
  return course
}

/** Resolve a lesson by public ID and assert it belongs to the given course. */
export async function resolveCourseLesson(
  courseInternalId: number,
  lessonPublicId: string,
): Promise<{ id: number; publicId: string; title: string }> {
  const rows = await db
    .select({ id: lessons.id, publicId: lessons.publicId, title: lessons.title })
    .from(lessons)
    .where(
      and(
        eq(lessons.publicId, lessonPublicId),
        eq(lessons.courseId, courseInternalId),
        isNull(lessons.deletedAt),
      ),
    )
    .limit(1)
  const lesson = rows.at(0)
  if (!lesson) throw new NotFoundError('Quiz lesson not found')
  return lesson
}
