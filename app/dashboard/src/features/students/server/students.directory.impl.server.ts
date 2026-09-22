/**
 * Server-only implementation of S-4.1 Student Directory: listing with
 * search/filter/sort/pagination, the stats row, Add Student (invite-based),
 * profile edits, status management, and student tags. Never import from
 * client code.
 */
import { and, asc, desc, eq, ilike, isNull, or, sql } from '@abugida/database'
import { courses } from '@abugida/database/catalog'
import { enrollments, studentTags } from '@abugida/database/learning'
import { users, verification } from '@abugida/database/auth'
import { auditLogs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import {
  createEnrollmentInTx,
  createNotifications,
  requireAdminRole,
  requireStudentReadRole,
  requireStudentWriteRole,
  resolveCourseByPublicId,
  resolveStudent,
  searchPattern,
} from './students.server-helpers.server'
import type {
  DirectoryQuery,
  StudentStatusInput,
  UpdateStudentInput,
  CreateStudentInput,
  AddTagInput,
} from '../schemas/students.schema'
import type {
  StudentDirectoryItem,
  StudentDirectoryPage,
  StudentDirectoryStats,
  StudentAccountStatus,
} from '../students.types'

const INVITE_TTL_DAYS = 7

function notStaffCondition() {
  return sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`
}

const baseFilters = [isNull(users.deletedAt), notStaffCondition()]

const courseCountExpr = sql<number>`COUNT(${enrollments.id}) FILTER (WHERE ${enrollments.deletedAt} IS NULL)::int`
const avgProgressExpr = sql<
  number | null
>`AVG(${enrollments.progressPercentage}) FILTER (WHERE ${enrollments.deletedAt} IS NULL)`
const lastActivityExpr = sql<string | null>`MAX(${enrollments.lastAccessedAt})`

function toItem(row: {
  id: string
  name: string | null
  email: string | null
  status: string
  courseCount: number
  avgProgress: number | null
  lastActivityAt: string | null
  joinedAt: Date
}): StudentDirectoryItem {
  return {
    id: row.id,
    name: row.name ?? 'Unnamed student',
    email: row.email ?? '',
    status: row.status as StudentAccountStatus,
    courseCount: Number(row.courseCount),
    avgProgress: row.avgProgress == null ? null : Math.round(Number(row.avgProgress)),
    lastActivityAt: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : null,
    joinedAt: row.joinedAt.toISOString(),
  }
}

export async function getDirectoryPageImpl(query: DirectoryQuery): Promise<StudentDirectoryPage> {
  await requireStudentReadRole()

  const filters = [...baseFilters]
  const pattern = searchPattern(query.q)
  if (pattern) {
    filters.push(or(ilike(users.name, pattern), ilike(users.email, pattern)) ?? isNull(users.id))
  }
  if (query.status && query.status !== 'all') {
    filters.push(eq(users.accountStatus, query.status))
  }
  if (query.course && query.course !== 'all') {
    const course = await resolveCourseByPublicId(query.course)
    filters.push(
      sql`EXISTS (SELECT 1 FROM ${enrollments} WHERE ${enrollments.studentId} = ${users.id} AND ${enrollments.courseId} = ${course.id} AND ${enrollments.deletedAt} IS NULL)`,
    )
  }
  const where = and(...filters)

  const page = query.page ?? 1
  const order = (() => {
    switch (query.sort) {
      case 'joined':
        return [desc(users.createdAt)]
      case 'last_active':
        return [sql`MAX(${enrollments.lastAccessedAt}) DESC NULLS LAST`, asc(users.name)]
      case 'courses':
        return [
          sql`COUNT(${enrollments.id}) FILTER (WHERE ${enrollments.deletedAt} IS NULL) DESC`,
          asc(users.name),
        ]
      case 'progress':
        return [
          sql`AVG(${enrollments.progressPercentage}) FILTER (WHERE ${enrollments.deletedAt} IS NULL) DESC NULLS LAST`,
          asc(users.name),
        ]
      default:
        return [asc(users.name), asc(users.email)]
    }
  })()

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: sql<string>`${users.accountStatus}::text`,
      courseCount: courseCountExpr,
      avgProgress: avgProgressExpr,
      lastActivityAt: lastActivityExpr,
      joinedAt: users.createdAt,
    })
    .from(users)
    .leftJoin(enrollments, eq(enrollments.studentId, users.id))
    .where(where)
    .groupBy(users.id, users.name, users.email, users.accountStatus, users.createdAt)
    .orderBy(...order)
    .limit(26)
    .offset((page - 1) * 25)

  const totalRows = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${users.id})::int` })
    .from(users)
    .where(where)

  return {
    items: rows.slice(0, 25).map(toItem),
    page,
    pageSize: 25,
    totalRows: Number(totalRows.at(0)?.count ?? 0),
    hasNextPage: rows.length > 25,
  }
}

export async function getDirectoryStatsImpl(): Promise<StudentDirectoryStats> {
  await requireStudentReadRole()

  const weekAgo = new Date(Date.now() - 7 * 86_400_000)

  const [totals, active, enrolledBeforeWeek] = await Promise.all([
    db
      .select({
        students: sql<number>`COUNT(DISTINCT ${users.id})::int`,
        enrollments: sql<number>`COUNT(${enrollments.id}) FILTER (WHERE ${enrollments.deletedAt} IS NULL)::int`,
      })
      .from(users)
      .leftJoin(enrollments, eq(enrollments.studentId, users.id))
      .where(and(...baseFilters)),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${users.id})::int` })
      .from(users)
      .innerJoin(enrollments, eq(enrollments.studentId, users.id))
      .where(
        and(
          ...baseFilters,
          sql`(${enrollments.lastAccessedAt} >= ${weekAgo.toISOString()} OR ${enrollments.createdAt} >= ${weekAgo.toISOString()})`,
          isNull(enrollments.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${users.id})::int` })
      .from(users)
      .innerJoin(enrollments, eq(enrollments.studentId, users.id))
      .where(
        and(
          ...baseFilters,
          isNull(enrollments.deletedAt),
          sql`${enrollments.createdAt} < ${weekAgo.toISOString()}`,
          or(
            sql`${enrollments.lastAccessedAt} IS NULL`,
            sql`${enrollments.lastAccessedAt} < ${weekAgo.toISOString()}`,
          ),
        ),
      ),
  ])

  const totalStudents = Number(totals.at(0)?.students ?? 0)
  const totalEnrollments = Number(totals.at(0)?.enrollments ?? 0)

  return {
    totalStudents,
    activeThisWeek: Number(active.at(0)?.count ?? 0),
    // Enrolled 7+ days ago with no activity this week — the "churned" bucket.
    inactiveThisWeek: Number(enrolledBeforeWeek.at(0)?.count ?? 0),
    avgCoursesPerUser:
      totalStudents > 0 ? Math.round((totalEnrollments / totalStudents) * 10) / 10 : null,
  }
}

/**
 * S-4.1 Add Student: collects name + email and records a sign-in invite.
 * Student accounts never store passwords — the row is created as
 * `pending_verification` and a Better Auth verification token is issued so
 * the invited student completes sign-in via Google/Telegram.
 */
export async function createStudentImpl(input: CreateStudentInput): Promise<{ id: string }> {
  const staffId = await requireStudentWriteRole()

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${input.email}`)
    .limit(1)
  if (existing.length > 0) throw new Error('EMAIL_EXISTS: a user with this email already exists')

  const student = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        emailVerified: false,
        accountStatus: 'pending_verification',
      })
      .returning({ id: users.id })
    const row = inserted.at(0)
    if (!row) throw new Error('CREATE_FAILED')

    await tx.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: input.email,
      value: crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    })

    await tx.insert(auditLogs).values({
      actorId: staffId,
      action: 'admin_action',
      resourceType: 'user_account',
      metadata: {
        action: 'invite_student',
        targetUserId: row.id,
        email: input.email,
        note: input.note ?? null,
      },
    })
    return row
  })

  return { id: student.id }
}

export async function updateStudentImpl(input: UpdateStudentInput): Promise<{ ok: true }> {
  const staffId = await requireStudentWriteRole()
  await resolveStudent(input.studentId)

  const duplicate = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${input.email} AND ${users.id} <> ${input.studentId}`)
    .limit(1)
  if (duplicate.length > 0) throw new Error('EMAIL_EXISTS: another user already uses this email')

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name: input.name, email: input.email, updatedAt: new Date() })
      .where(eq(users.id, input.studentId))
    await tx.insert(auditLogs).values({
      actorId: staffId,
      action: 'admin_action',
      resourceType: 'user_account',
      metadata: { action: 'update_student', targetUserId: input.studentId },
    })
  })
  return { ok: true }
}

/** Account status management (suspend/lock/reactivate) — admin only. */
export async function setStudentStatusImpl(input: StudentStatusInput): Promise<{ ok: true }> {
  const staffId = await requireAdminRole()
  await resolveStudent(input.studentId)
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ accountStatus: input.status, updatedAt: new Date() })
      .where(eq(users.id, input.studentId))
    await tx.insert(auditLogs).values({
      actorId: staffId,
      action: 'admin_action',
      resourceType: 'user_account',
      metadata: {
        action: 'set_student_status',
        targetUserId: input.studentId,
        status: input.status,
      },
    })
  })
  return { ok: true }
}

export async function addStudentTagImpl(input: AddTagInput): Promise<{ ok: true }> {
  await requireStudentWriteRole()
  await resolveStudent(input.studentId)
  await db
    .insert(studentTags)
    .values({ studentId: input.studentId, tag: input.tag })
    .onConflictDoNothing()
  return { ok: true }
}

export async function removeStudentTagImpl(input: AddTagInput): Promise<{ ok: true }> {
  await requireStudentWriteRole()
  await db
    .delete(studentTags)
    .where(and(eq(studentTags.studentId, input.studentId), eq(studentTags.tag, input.tag)))
  return { ok: true }
}

/**
 * Manual enrollment (S-4.2 "Enroll in New Course" + S-4.1 bulk enroll).
 * Grants paid access at no charge — the caller passes the client's explicit
 * acknowledgement; the server still refuses when it was not provided.
 */
export async function enrollStudentsImpl(input: {
  studentIds: string[]
  coursePublicId: string
  acknowledgedPaid: boolean
}): Promise<{ enrolled: number; skipped: number }> {
  await requireStudentWriteRole()
  const course = await resolveCourseByPublicId(input.coursePublicId)
  if (!input.acknowledgedPaid && !course.isFree) {
    throw new Error('PAID_CONFIRMATION_REQUIRED: confirm granting paid access at no charge')
  }

  let enrolled = 0
  let skipped = 0
  const enrolledIds: string[] = []
  await db.transaction(async (tx) => {
    for (const studentId of input.studentIds) {
      try {
        await createEnrollmentInTx(tx, { studentId, courseId: course.id })
        enrolled += 1
        enrolledIds.push(studentId)
      } catch {
        skipped += 1
      }
    }
  })

  await createNotifications(enrolledIds, {
    type: 'enrollment',
    title: 'You were enrolled in a new course',
    body: course.title,
    linkEntityType: 'course',
    linkEntityPublicId: course.publicId,
  })
  return { enrolled, skipped }
}

/** Remove a student's enrollment (S-4.2 courses tab row action). */
export async function unenrollStudentImpl(input: {
  studentId: string
  coursePublicId: string
}): Promise<{ ok: true }> {
  const staffId = await requireStudentWriteRole()
  const course = await resolveCourseByPublicId(input.coursePublicId)
  const now = new Date()
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: enrollments.id, publicId: enrollments.publicId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, input.studentId),
          eq(enrollments.courseId, course.id),
          isNull(enrollments.deletedAt),
        ),
      )
      .limit(1)
    const enrollment = existing.at(0)
    if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND')

    await tx
      .update(enrollments)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(enrollments.id, enrollment.id))
    await tx.insert(auditLogs).values({
      actorId: staffId,
      action: 'enrollment_status_changed',
      resourceType: 'enrollment',
      enrollmentId: enrollment.id,
      metadata: { studentId: input.studentId, courseId: course.id, change: 'removed' },
    })
  })
  return { ok: true }
}

/** Course picker data for the enroll dialog (published courses only). */
export async function listEnrollableCoursesImpl(): Promise<
  Array<{
    publicId: string
    title: string
    isFree: boolean
    priceLabel: string | null
    requiresApproval: boolean
    capacity: number | null
    activeEnrollments: number
  }>
> {
  await requireStudentReadRole()
  const rows = await db
    .select({
      id: courses.id,
      publicId: courses.publicId,
      title: courses.title,
      isFree: courses.isFree,
      priceAmount: courses.priceAmount,
      priceCurrency: courses.priceCurrency,
      requiresApproval: courses.requiresApproval,
      capacity: courses.capacity,
    })
    .from(courses)
    .where(and(eq(courses.status, 'published'), isNull(courses.deletedAt)))
    .orderBy(asc(courses.title))
    .limit(200)

  const courseIds = rows.map((row) => row.id)
  const counts = courseIds.length
    ? await db
        .select({
          courseId: enrollments.courseId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(enrollments)
        .where(
          and(
            sql`${enrollments.courseId} = ANY(${sql.raw(`ARRAY[${courseIds.join(',')}]::bigint[]`)})`,
            isNull(enrollments.deletedAt),
          ),
        )
        .groupBy(enrollments.courseId)
    : []
  const countByCourse = new Map(counts.map((row) => [row.courseId, Number(row.count)]))

  return rows.map((row) => ({
    publicId: row.publicId,
    title: row.title,
    isFree: row.isFree,
    priceLabel:
      row.isFree || row.priceAmount == null
        ? null
        : `${Number(row.priceAmount).toLocaleString()} ${row.priceCurrency}`,
    requiresApproval: row.requiresApproval,
    capacity: row.capacity,
    activeEnrollments: countByCourse.get(row.id) ?? 0,
  }))
}

export async function getStudentTagsImpl(studentId: string): Promise<string[]> {
  await requireStudentReadRole()
  const rows = await db
    .select({ tag: studentTags.tag })
    .from(studentTags)
    .where(eq(studentTags.studentId, studentId))
    .orderBy(asc(studentTags.tag))
  return rows.map((row) => row.tag)
}

export async function getStudentsReferenceImpl(): Promise<{
  cohorts: Array<{ publicId: string; name: string }>
  tags: Array<{ tag: string; count: number }>
}> {
  await requireStudentReadRole()
  const { cohorts } = await import('@abugida/database/learning')
  const [cohortRows, tagRows] = await Promise.all([
    db
      .select({ publicId: cohorts.publicId, name: cohorts.name })
      .from(cohorts)
      .where(isNull(cohorts.deletedAt))
      .orderBy(asc(cohorts.name))
      .limit(100),
    db
      .select({ tag: studentTags.tag, count: sql<number>`COUNT(*)::int` })
      .from(studentTags)
      .groupBy(studentTags.tag)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(30),
  ])
  return {
    cohorts: cohortRows,
    tags: tagRows.map((row) => ({ tag: row.tag, count: Number(row.count) })),
  }
}
