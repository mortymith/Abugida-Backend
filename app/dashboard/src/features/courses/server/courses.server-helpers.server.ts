/**
 * Server-only helpers shared by the courses feature impl modules:
 * session/role requirements, course resolution, slug generation, and
 * notification fan-out. Never import from client code.
 */
import { and, eq, isNull, ne, sql } from '@abugida/database'
import { courses, modules, lessons } from '@abugida/database/catalog'
import { member } from '@abugida/database/auth'
import { notifications } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import {
  COURSE_AUTHORING_ROLES,
  hasAtLeastRole,
  mapBetterAuthRoleToPlatformRole,
  ROLE_PRIORITY,
} from '#/features/auth/auth.roles'
import type { PlatformRole } from '#/features/auth/auth.roles'

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

/** Authoring screens (S-2.2 → S-2.13, S-2.15, S-2.16): admin/editor only. */
export async function requireAuthoringRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!COURSE_AUTHORING_ROLES.includes(role)) throw new Error('FORBIDDEN')
  return userId
}

/** At least the given platform role (used for view-only surfaces). */
export async function requireAtRole(minimum: PlatformRole): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!hasAtLeastRole(role, minimum)) throw new Error('FORBIDDEN')
  return userId
}

export async function requireRoleIn(allowed: readonly PlatformRole[]): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!allowed.includes(role)) throw new Error('FORBIDDEN')
  return userId
}

/** Resolve a course by public id or throw. */
export async function resolveCourse(coursePublicId: string) {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.publicId, coursePublicId), isNull(courses.deletedAt)))
    .limit(1)
  const course = rows.at(0)
  if (!course) throw new Error('COURSE_NOT_FOUND')
  return course
}

export async function resolveLesson(lessonPublicId: string) {
  const rows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.publicId, lessonPublicId), isNull(lessons.deletedAt)))
    .limit(1)
  const lesson = rows.at(0)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')
  return lesson
}

/** Next sort position for a course's modules. */
export async function nextModuleSortOrder(courseId: number): Promise<number> {
  const rows = await db
    .select({ max: sql<number>`COALESCE(MAX(${modules.sortOrder}), -1)::int` })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
  return (rows.at(0)?.max ?? -1) + 1
}

/** Next sort position within a module. */
export async function nextLessonSortOrder(moduleId: number): Promise<number> {
  const rows = await db
    .select({ max: sql<number>`COALESCE(MAX(${lessons.sortOrder}), -1)::int` })
    .from(lessons)
    .where(and(eq(lessons.moduleId, moduleId), isNull(lessons.deletedAt)))
  return (rows.at(0)?.max ?? -1) + 1
}

/** Slug collision loop: base-N, base-2, ... until free (soft-deleted included). */
export async function uniqueCourseSlug(base: string): Promise<string> {
  const normalized = base.slice(0, 180) || 'course'
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? normalized : `${normalized}-${attempt + 1}`
    const rows = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.slug, candidate), isNull(courses.deletedAt)))
      .limit(1)
    if (rows.length === 0) return candidate
  }
  return `${normalized}-${Date.now().toString(36)}`
}

/**
 * In-app notification fan-out (S-1.4 contract). `recipientIds` are the
 * target user ids; rows are per-recipient so read state is independent.
 */
export async function createNotifications(
  recipientIds: string[],
  input: {
    type: 'system' | 'publish' | 'review' | 'team_invite' | 'mention'
    title: string
    body?: string | null
    linkEntityType?: 'course' | 'lesson' | 'review_queue' | 'revenue' | 'notification'
    linkEntityPublicId?: string | null
  },
): Promise<void> {
  const unique = Array.from(new Set(recipientIds)).filter(Boolean)
  if (unique.length === 0) return
  await db.insert(notifications).values(
    unique.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkEntityType: input.linkEntityType ?? null,
      linkEntityPublicId: input.linkEntityPublicId ?? null,
    })),
  )
}

/** User ids holding the given platform roles (org-member based). */
export async function userIdsWithPlatformRoles(roles: PlatformRole[]): Promise<string[]> {
  const rows = await db.select({ userId: member.userId, role: member.role }).from(member)
  const matched = rows
    .filter((row) => roles.includes(mapBetterAuthRoleToPlatformRole(row.role)))
    .map((row) => row.userId)
  return Array.from(new Set(matched))
}

/** Recompute compact sort orders 0..n-1 for a course's non-deleted modules. */
export async function normalizeModuleOrder(courseId: number): Promise<void> {
  const rows = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
    .orderBy(modules.sortOrder)
  await Promise.all(
    rows.map((row, index) =>
      db
        .update(modules)
        .set({ sortOrder: index })
        .where(and(eq(modules.id, row.id), ne(modules.sortOrder, index))),
    ),
  )
}

/** Escape user text for LIKE/ILIKE patterns (no wildcard injection). */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
}

export function rolePriority(role: PlatformRole): number {
  return ROLE_PRIORITY[role]
}
