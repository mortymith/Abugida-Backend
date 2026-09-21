/**
 * Server-only implementation of S-1.3 Global Search.
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 */
import { and, asc, eq, ilike, isNull, or, sql } from '@abugida/database'
import {
  assetLibrary,
  courses,
  courseStats,
  lessons,
  modules,
  transcripts,
  transcriptSegments,
} from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { resolveEntityLink } from '#/lib/entity-links'
import type { GlobalSearchPayload, SearchGroup, SearchResultsItem } from '../search.types'

const PER_GROUP_MAX = 20

/** Escape LIKE wildcards so user input is matched literally. */
function likeLiteral(input: string): string {
  return input.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

export async function loadGlobalSearch(data: { query: string }): Promise<GlobalSearchPayload> {
  // Role resolved server-side — never trusted from client input.
  const { getServerRoleImpl } = await import('#/features/auth/server/auth.roles.impl.server')
  const role = await getServerRoleImpl()

  const term = `%${likeLiteral(data.query)}%`

  // ── Courses ───────────────────────────────────────────────────────────
  const courseRows = await db
    .select({
      id: sql<string>`(${courses.publicId})::text`,
      title: courses.title,
      status: sql<string>`${courses.status}::text`,
      students: sql<number>`COALESCE(${courseStats.totalEnrollments}, 0)::int`,
    })
    .from(courses)
    .leftJoin(courseStats, eq(courseStats.courseId, courses.id))
    .where(
      and(
        isNull(courses.deletedAt),
        or(ilike(courses.title, term), ilike(courses.description, term)),
      ),
    )
    .orderBy(asc(courses.title))
    .limit(PER_GROUP_MAX)

  // ── Lessons (with parent course context) ──────────────────────────────
  const lessonRows = await db
    .select({
      id: sql<string>`(${lessons.publicId})::text`,
      title: lessons.title,
      courseTitle: courses.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(isNull(courses.deletedAt), ilike(lessons.title, term)))
    .orderBy(asc(lessons.title))
    .limit(PER_GROUP_MAX)

  // ── Assets (role-gated; includes published transcript text — spec 05) ──
  const canSeeAssets = role !== 'support'
  const assetRows = canSeeAssets
    ? await db
        .selectDistinct({
          id: sql<string>`(${assetLibrary.publicId})::text`,
          name: assetLibrary.name,
          category: sql<string>`${assetLibrary.category}::text`,
        })
        .from(assetLibrary)
        .leftJoin(transcripts, eq(transcripts.assetId, assetLibrary.id))
        .leftJoin(
          transcriptSegments,
          and(
            eq(transcriptSegments.transcriptId, transcripts.id),
            eq(transcripts.status, 'published'),
          ),
        )
        .where(
          and(
            isNull(assetLibrary.deletedAt),
            or(
              ilike(assetLibrary.name, term),
              ilike(assetLibrary.description, term),
              sql`${assetLibrary.tags}::text ILIKE ${term}`,
              ilike(transcriptSegments.text, term),
            ),
          ),
        )
        .orderBy(asc(assetLibrary.name))
        .limit(PER_GROUP_MAX)
    : []

  // ── Students (role-gated) ─────────────────────────────────────────────
  const canSeeStudents = role !== 'viewer'
  const studentRows = canSeeStudents
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(or(ilike(users.name, term), ilike(users.email, term)))
        .orderBy(asc(users.name))
        .limit(PER_GROUP_MAX)
    : []

  const courseItems: SearchResultsItem[] = courseRows.map((row) => {
    const link = resolveEntityLink('course', row.id)
    return {
      kind: 'course',
      id: row.id,
      title: row.title,
      subtitle: `${row.status} · ${row.students} students`,
      url: link.path,
      exists: link.exists,
    }
  })

  const lessonItems: SearchResultsItem[] = lessonRows.map((row) => {
    const link = resolveEntityLink('lesson', row.id)
    return {
      kind: 'lesson',
      id: row.id,
      title: row.title,
      subtitle: row.courseTitle,
      url: link.path,
      exists: link.exists,
    }
  })

  const studentItems: SearchResultsItem[] = studentRows.map((row) => {
    const link = resolveEntityLink('student', row.id)
    return {
      kind: 'student',
      id: row.id,
      title: row.name ?? 'Unnamed user',
      subtitle: row.email ?? undefined,
      url: link.path,
      exists: link.exists,
    }
  })

  const assetItems: SearchResultsItem[] = assetRows.map((row) => {
    const link = resolveEntityLink('asset', row.id)
    return {
      kind: 'asset',
      id: row.id,
      title: row.name,
      subtitle: row.category,
      url: link.path,
      exists: link.exists,
    }
  })

  const groups: SearchGroup[] = [
    { kind: 'course', label: 'Courses', total: courseItems.length, items: courseItems },
    { kind: 'lesson', label: 'Lessons', total: lessonItems.length, items: lessonItems },
    { kind: 'asset', label: 'Assets', total: assetItems.length, items: assetItems },
    { kind: 'student', label: 'Students', total: studentItems.length, items: studentItems },
  ].filter((group): group is SearchGroup => group.items.length > 0)

  const omittedGroups: GlobalSearchPayload['omittedGroups'] = []
  if (!canSeeAssets) {
    omittedGroups.push({ kind: 'asset', reason: 'Not available for your role.' })
  }
  if (!canSeeStudents) {
    omittedGroups.push({ kind: 'student', reason: 'Not available for your role.' })
  }

  return {
    query: data.query,
    groups,
    totalMatches: groups.reduce((sum, group) => sum + group.total, 0),
    omittedGroups,
  }
}
