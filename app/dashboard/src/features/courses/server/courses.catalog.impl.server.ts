/**
 * Server-only implementation of S-2.1 Course Catalog.
 * Never import from client code.
 */
import { and, asc, desc, eq, ilike, isNull, ne, or, sql } from '@abugida/database'
import { courses, courseStats, modules, lessons, examTypes } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { escapeLike } from './courses.server-helpers.server'
import { COURSES_PAGE_SIZE } from '../schemas/courses.catalog.schema'
import type { CatalogQuery } from '../schemas/courses.catalog.schema'
import type { CourseCatalogItem, CourseCatalogResult } from '../courses.types'

export async function loadCourseCatalog(data: CatalogQuery): Promise<CourseCatalogResult> {
  const filters = [isNull(courses.deletedAt)]
  if (data.status === 'all') {
    // Archived courses are hidden from the default view (spec S-2.1).
    filters.push(ne(courses.status, 'archived'))
  } else {
    filters.push(eq(courses.status, data.status))
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
  const lessonCountSql = sql<number>`(
    SELECT COUNT(*)::int FROM ${lessons}
    WHERE ${lessons.courseId} = ${courses.id} AND ${lessons.deletedAt} IS NULL
  )`

  const orderBy =
    data.sort === 'title'
      ? asc(courses.title)
      : data.sort === 'students'
        ? desc(sql`COALESCE(${courseStats.totalEnrollments}, 0)`)
        : desc(courses.updatedAt)

  const rows = await db
    .select({
      publicId: courses.publicId,
      title: courses.title,
      description: courses.description,
      thumbnailObjectKey: courses.thumbnailObjectKey,
      status: courses.status,
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

  const totalRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(courses)
    .where(and(...filters))

  const items: CourseCatalogItem[] = rows.slice(0, COURSES_PAGE_SIZE).map((row) => ({
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    thumbnailObjectKey: row.thumbnailObjectKey,
    status: row.status ?? 'draft',
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
  }))

  return {
    items,
    totalCount: Number(totalRows.at(0)?.count ?? 0),
    page: data.page,
    pageSize: COURSES_PAGE_SIZE,
  }
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
