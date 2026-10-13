/**
 * Server-only implementation of S-2.1 Course Catalog.
 * Never import from client code.
 */
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, ne, or, sql } from '@abugida/database'
import type { SQL } from 'drizzle-orm'
import { courses, courseStats, modules, lessons, examTypes } from '@abugida/database/catalog'
import { reviewRequests } from '@abugida/database/ops'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { activeWorkspaceScope, escapeLike, requireUserId } from './courses.server-helpers.server'
import { loadCatalogAuthoringHealth } from './courses.readiness.impl.server'
import { COURSES_PAGE_SIZE } from '../schemas/courses.catalog.schema'
import type { CatalogQuery } from '../schemas/courses.catalog.schema'
import type { CatalogStatusCounts, CourseCatalogItem, CourseCatalogResult } from '../courses.types'

/**
 * A `Scheduled` course is any course carrying a **future**
 * `scheduled_publish_at` (spec 04 S-2.1). A schedule that has already run is a
 * past tense, not a filter, so it falls back to its lifecycle status instead of
 * lingering in this bucket forever.
 */
const SCHEDULED_PREDICATE = and(
  isNotNull(courses.scheduledPublishAt),
  gt(courses.scheduledPublishAt, new Date()),
) as SQL

/**
 * The `Approved` filter matches exactly `review_requests.entity_type =
 * 'course' AND decision = 'approved' AND courses.status = 'draft'` (spec 04
 * S-2.1). It reads the **request**, not `courses.approved_at`, so the filter and
 * the queue cannot disagree about what was approved.
 */
const APPROVED_PREDICATE = and(
  eq(courses.status, 'draft'),
  // Correlated EXISTS written as raw SQL: `@abugida/database` deliberately
  // re-exports only a fixed set of Drizzle operators, and `exists` is not one.
  sql`EXISTS (
    SELECT 1 FROM ${reviewRequests}
    WHERE ${reviewRequests.courseId} = ${courses.id}
      AND ${reviewRequests.entityType} = 'course'
      AND ${reviewRequests.state} = 'approved'
  )`,
) as SQL

export async function loadCourseCatalog(data: CatalogQuery): Promise<CourseCatalogResult> {
  await requireUserId()
  // Every catalog row is the **active workspace's** (spec 13): a course in
  // another workspace is not visible, searchable, or countable here.
  const filters: SQL[] = [isNull(courses.deletedAt), await activeWorkspaceScope()]
  switch (data.status) {
    case 'all':
      // Archived courses are hidden from the default view (spec S-2.1).
      filters.push(ne(courses.status, 'archived'))
      break
    case 'in_review':
      filters.push(eq(courses.status, 'in_review'))
      break
    case 'published':
      filters.push(eq(courses.status, 'published'))
      break
    case 'archived':
      filters.push(eq(courses.status, 'archived'))
      break
    case 'approved':
      filters.push(APPROVED_PREDICATE)
      break
    case 'scheduled':
      filters.push(SCHEDULED_PREDICATE)
      break
    case 'draft':
    default:
      // `draft` excludes approved-but-unpublished courses, which the Approved
      // filter owns — otherwise the two pills would show the same courses.
      filters.push(
        and(
          eq(courses.status, 'draft'),
          sql`NOT EXISTS (
            SELECT 1 FROM ${reviewRequests}
            WHERE ${reviewRequests.courseId} = ${courses.id}
              AND ${reviewRequests.entityType} = 'course'
              AND ${reviewRequests.state} = 'approved'
          )`,
        ) as SQL,
      )
      break
  }
  if (data.type !== 'all') filters.push(eq(courses.courseType, data.type))
  if (data.search && data.search.trim()) {
    const pattern = `%${escapeLike(data.search.trim())}%`
    filters.push(
      or(ilike(courses.title, pattern), ilike(courses.description, pattern)) ?? isNull(courses.id),
    )
  }

  const moduleCountSql = sql<number>`(
    SELECT COUNT(*)::int FROM ${modules}
    WHERE ${modules.courseId} = ${courses.id} AND ${modules.deletedAt} IS NULL
  )`
  // The card's item count is the **published set**, not the whole curriculum:
  // an unpublished item is not something the course ships.
  const lessonCountSql = sql<number>`(
    SELECT COUNT(*)::int FROM ${lessons}
    WHERE ${lessons.courseId} = ${courses.id}
      AND ${lessons.deletedAt} IS NULL
      AND ${lessons.archivedAt} IS NULL
      AND ${lessons.visibility} = 'published'
  )`

  const orderBy =
    data.sort === 'title'
      ? asc(courses.title)
      : data.sort === 'students'
        ? desc(sql`COALESCE(${courseStats.totalEnrollments}, 0)`)
        : desc(courses.updatedAt)

  const rows = await db
    .select({
      id: courses.id,
      publicId: courses.publicId,
      title: courses.title,
      description: courses.description,
      thumbnailObjectKey: courses.thumbnailObjectKey,
      status: courses.status,
      approvedAt: courses.approvedAt,
      scheduledPublishAt: courses.scheduledPublishAt,
      courseType: courses.courseType,
      level: courses.level,
      isFree: courses.isFree,
      priceAmount: courses.priceAmount,
      priceCurrency: courses.priceCurrency,
      requiresApproval: courses.requiresApproval,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      studentCount: sql<number>`COALESCE(${courseStats.totalEnrollments}, 0)::int`,
      averageRating: courseStats.averageRating,
      moduleCount: moduleCountSql,
      lessonCount: lessonCountSql,
    })
    .from(courses)
    .leftJoin(users, eq(courses.instructorId, users.id))
    .leftJoin(courseStats, eq(courseStats.courseId, courses.id))
    .where(and(...filters))
    .orderBy(orderBy)
    .limit(COURSES_PAGE_SIZE + 1)
    .offset(data.page * COURSES_PAGE_SIZE)

  const [totalRows, statusCounts, health] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(and(...filters)),
    // Counts are computed against the *unfiltered* workspace, minus the search
    // term only, so the pills stay stable while the user picks one.
    loadCatalogStatusCounts(data),
    loadCatalogAuthoringHealth(
      rows.slice(0, COURSES_PAGE_SIZE).map((row) => row.id),
      new Map(rows.map((row) => [row.id, row.scheduledPublishAt])),
    ),
  ])

  const items: CourseCatalogItem[] = rows.slice(0, COURSES_PAGE_SIZE).map((row) => ({
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    thumbnailObjectKey: row.thumbnailObjectKey,
    status: row.status ?? 'draft',
    approvedAt: row.approvedAt?.toISOString() ?? null,
    scheduledPublishAt: row.scheduledPublishAt?.toISOString() ?? null,
    courseType: row.courseType ?? 'self_paced',
    level: row.level,
    isFree: row.isFree,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    instructorName: row.instructorName ?? null,
    moduleCount: Number(row.moduleCount),
    lessonCount: Number(row.lessonCount),
    studentCount: Number(row.studentCount),
    averageRating: row.averageRating == null ? null : Number(row.averageRating),
    updatedAt: row.updatedAt.toISOString(),
    requiresApproval: row.requiresApproval,
    authoringHealth: health.get(row.id) ?? { variant: 'not_started', nextAction: null, count: 0 },
    statusCounts,
  }))

  return {
    items,
    totalCount: Number(totalRows.at(0)?.count ?? 0),
    page: data.page,
    pageSize: COURSES_PAGE_SIZE,
  }
}

/**
 * Per-status totals for the S-2.1 filter pills. `Approved` and `Scheduled` are
 * derived buckets rather than `courses.status` values, so they are counted with
 * their own predicates instead of being read off the enum.
 */
export async function loadCatalogStatusCounts(data: CatalogQuery): Promise<CatalogStatusCounts> {
  const scope: SQL[] = [isNull(courses.deletedAt), await activeWorkspaceScope()]
  const searchFilter =
    data.search && data.search.trim()
      ? or(
          ilike(courses.title, `%${escapeLike(data.search.trim())}%`),
          ilike(courses.description, `%${escapeLike(data.search.trim())}%`),
        )
      : undefined
  const withSearch = searchFilter ? [...scope, searchFilter] : scope

  const [total, draft, inReview, published, archived, approved, scheduled] = await Promise.all([
    countCourses(and(...scope, ne(courses.status, 'archived'))),
    countCourses(
      and(
        ...withSearch,
        eq(courses.status, 'draft'),
        sql`NOT EXISTS (
          SELECT 1 FROM ${reviewRequests}
          WHERE ${reviewRequests.courseId} = ${courses.id}
            AND ${reviewRequests.entityType} = 'course'
            AND ${reviewRequests.state} = 'approved'
        )`,
      ) as SQL,
    ),
    countCourses(and(...withSearch, eq(courses.status, 'in_review'))),
    countCourses(and(...withSearch, eq(courses.status, 'published'))),
    countCourses(and(...withSearch, eq(courses.status, 'archived'))),
    countCourses(and(...withSearch, APPROVED_PREDICATE)),
    countCourses(and(...withSearch, SCHEDULED_PREDICATE)),
  ])

  return {
    all: total,
    draft,
    inReview,
    approved,
    scheduled,
    published,
    archived,
  }
}

async function countCourses(predicate: SQL | undefined): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(courses)
    .where(predicate)
  return Number(rows.at(0)?.count ?? 0)
}

/** Exam types (categories) for filters and the wizard dropdown. */
export async function loadExamTypes(): Promise<
  Array<{ id: number; publicId: string; name: string }>
> {
  const rows = await db
    .select({ id: examTypes.id, publicId: examTypes.publicId, name: examTypes.name })
    .from(examTypes)
    .where(and(eq(examTypes.isActive, true), isNull(examTypes.deletedAt)))
    .orderBy(asc(examTypes.sortOrder), asc(examTypes.name))
  return rows
}
