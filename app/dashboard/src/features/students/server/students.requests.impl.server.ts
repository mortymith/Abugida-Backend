/**
 * Server-only implementation of S-4.6 Enrollment Requests / Waitlist:
 * pending queue, approve/deny (single + bulk), and waitlist promotion.
 * Approving creates a real enrollment (source `admin_grant`) and notifies
 * the student. Request rows are created learner-side (requires-approval
 * courses); the dashboard manages the decision end.
 */
import { and, asc, desc, eq, ilike, isNull, or, sql } from '@abugida/database'
import { courses } from '@abugida/database/catalog'
import { enrollmentRequests, waitlistEntries } from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  countActiveEnrollments,
  createEnrollmentInTx,
  createNotifications,
  requireRequestDecisionRole,
  requireStudentReadRole,
  searchPattern,
} from './students.server-helpers.server'
import type {
  BulkApproveInput,
  PromoteWaitlistInput,
  RequestDecisionInput,
  RequestsQuery,
} from '../schemas/students.schema'
import type { EnrollmentRequestItem, WaitlistOverviewItem } from '../students.types'

export async function getEnrollmentRequestsImpl(
  query: RequestsQuery,
): Promise<{ items: EnrollmentRequestItem[] }> {
  await requireStudentReadRole()

  const filters = [eq(enrollmentRequests.status, 'pending'), isNull(users.deletedAt)]
  const pattern = searchPattern(query.q)
  if (pattern) {
    filters.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(courses.title, pattern)) ??
        isNull(users.id),
    )
  }

  const rows = await db
    .select({
      publicId: enrollmentRequests.publicId,
      studentId: enrollmentRequests.studentId,
      studentName: users.name,
      studentEmail: users.email,
      coursePublicId: courses.publicId,
      courseTitle: courses.title,
      requestedAt: enrollmentRequests.createdAt,
      note: enrollmentRequests.note,
    })
    .from(enrollmentRequests)
    .innerJoin(users, eq(users.id, enrollmentRequests.studentId))
    .innerJoin(courses, eq(courses.id, enrollmentRequests.courseId))
    .where(and(...filters))
    .orderBy(desc(enrollmentRequests.createdAt))
    .limit(200)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      studentId: row.studentId,
      studentName: row.studentName ?? 'Unnamed student',
      studentEmail: row.studentEmail ?? '',
      coursePublicId: row.coursePublicId,
      courseTitle: row.courseTitle,
      requestedAt: row.requestedAt.toISOString(),
      note: row.note,
    })),
  }
}

/**
 * Approve one request: pending → approved, enrollment created, student
 * notified. Throws when the request is no longer pending or the student is
 * already enrolled (both surfaced as clear error toasts).
 */
export async function decideRequestImpl(
  input: RequestDecisionInput & { decision: 'approved' | 'denied' },
): Promise<{ ok: true }> {
  const staffId = await requireRequestDecisionRole()

  const requestRows = await db
    .select({
      id: enrollmentRequests.id,
      studentId: enrollmentRequests.studentId,
      courseId: enrollmentRequests.courseId,
      status: enrollmentRequests.status,
    })
    .from(enrollmentRequests)
    .where(eq(enrollmentRequests.publicId, input.requestPublicId))
    .limit(1)
  const request = requestRows.at(0)
  if (!request) throw new Error('REQUEST_NOT_FOUND')
  if (request.status !== 'pending') {
    throw new Error('REQUEST_ALREADY_DECIDED: this request was already handled')
  }

  await db.transaction(async (tx) => {
    if (input.decision === 'approved') {
      await createEnrollmentInTx(tx, {
        studentId: request.studentId,
        courseId: request.courseId,
      })
    }
    await tx
      .update(enrollmentRequests)
      .set({
        status: input.decision,
        decidedBy: staffId,
        decidedAt: new Date(),
        decisionNote: input.decisionNote ?? null,
      })
      .where(eq(enrollmentRequests.id, request.id))
  })

  const courseRows = await db
    .select({ title: courses.title, publicId: courses.publicId })
    .from(courses)
    .where(eq(courses.id, request.courseId))
    .limit(1)
  const course = courseRows.at(0)

  await createNotifications([request.studentId], {
    type: 'enrollment',
    title:
      input.decision === 'approved'
        ? 'Your enrollment request was approved'
        : 'Your enrollment request was not approved',
    body: course?.title ?? null,
    linkEntityType: 'course',
    linkEntityPublicId: course?.publicId ?? null,
  })
  return { ok: true }
}

/**
 * Bulk-approve (S-4.6 "Approve All"): per-request transactions so one
 * conflict (e.g. already enrolled) doesn't roll back the rest. Returns
 * counts for the success toast.
 */
export async function bulkApproveRequestsImpl(
  input: BulkApproveInput,
): Promise<{ approved: number; failed: number }> {
  let approved = 0
  let failed = 0
  for (const requestPublicId of input.requestPublicIds) {
    try {
      await decideRequestImpl({ requestPublicId, decision: 'approved' })
      approved += 1
    } catch {
      failed += 1
    }
  }
  return { approved, failed }
}

/** Waitlist overview per course (S-4.6 bottom panel). */
export async function getWaitlistOverviewImpl(): Promise<WaitlistOverviewItem[]> {
  await requireStudentReadRole()

  const courseIdsWithWaiting = db
    .select({ courseId: waitlistEntries.courseId })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.status, 'waiting'))
    .groupBy(waitlistEntries.courseId)
    .as('waiting_courses')

  const rows = await db
    .select({
      coursePublicId: courses.publicId,
      courseTitle: courses.title,
      capacity: courses.capacity,
      activeEnrollments: sql<number>`(
        SELECT COUNT(*)::int FROM enrollments e
        WHERE e.course_id = ${courses.id} AND e.deleted_at IS NULL
      )`,
      waitingCount: sql<number>`(
        SELECT COUNT(*)::int FROM waitlist_entries w
        WHERE w.course_id = ${courses.id} AND w.status = 'waiting'
      )`,
      nextStudentId: sql<string | null>`(
        SELECT w.student_id FROM waitlist_entries w
        WHERE w.course_id = ${courses.id} AND w.status = 'waiting'
        ORDER BY w.position ASC LIMIT 1
      )`,
      nextStudentName: sql<string | null>`(
        SELECT u.name FROM waitlist_entries w
        JOIN users u ON u.id = w.student_id
        WHERE w.course_id = ${courses.id} AND w.status = 'waiting'
        ORDER BY w.position ASC LIMIT 1
      )`,
    })
    .from(courseIdsWithWaiting)
    .innerJoin(
      courses,
      and(eq(courses.id, courseIdsWithWaiting.courseId), isNull(courses.deletedAt)),
    )
    .orderBy(asc(courses.title))
    .limit(50)

  return rows.map((row) => ({
    coursePublicId: row.coursePublicId,
    courseTitle: row.courseTitle,
    capacity: row.capacity,
    activeEnrollments: Number(row.activeEnrollments),
    waitingCount: Number(row.waitingCount),
    nextStudent:
      row.nextStudentId != null
        ? { studentId: row.nextStudentId, studentName: row.nextStudentName ?? 'Unnamed student' }
        : null,
  }))
}

/**
 * Promote the first waiting student when a seat opens (S-4.6). Creates the
 * enrollment, marks the entry promoted, and notifies the student.
 */
export async function promoteFromWaitlistImpl(
  input: PromoteWaitlistInput,
): Promise<{ promoted: { studentId: string; studentName: string } | null }> {
  await requireRequestDecisionRole()

  const courseRows = await db
    .select({
      id: courses.id,
      publicId: courses.publicId,
      title: courses.title,
      capacity: courses.capacity,
    })
    .from(courses)
    .where(and(eq(courses.publicId, input.coursePublicId), isNull(courses.deletedAt)))
    .limit(1)
  const course = courseRows.at(0)
  if (!course) throw new Error('COURSE_NOT_FOUND')

  const activeEnrollments = await countActiveEnrollments(course.id)
  if (course.capacity != null && activeEnrollments >= course.capacity) {
    throw new Error('COURSE_FULL: no seats have opened yet')
  }

  const nextRows = await db
    .select({
      id: waitlistEntries.id,
      studentId: waitlistEntries.studentId,
      studentName: users.name,
    })
    .from(waitlistEntries)
    .innerJoin(users, eq(users.id, waitlistEntries.studentId))
    .where(and(eq(waitlistEntries.courseId, course.id), eq(waitlistEntries.status, 'waiting')))
    .orderBy(asc(waitlistEntries.position))
    .limit(1)
  const next = nextRows.at(0)
  if (!next) return { promoted: null }

  await db.transaction(async (tx) => {
    await createEnrollmentInTx(tx, { studentId: next.studentId, courseId: course.id })
    await tx
      .update(waitlistEntries)
      .set({ status: 'promoted', promotedAt: new Date() })
      .where(eq(waitlistEntries.id, next.id))
  })

  await createNotifications([next.studentId], {
    type: 'enrollment',
    title: 'A seat opened up — you are in',
    body: course.title,
    linkEntityType: 'course',
    linkEntityPublicId: course.publicId,
  })
  return {
    promoted: { studentId: next.studentId, studentName: next.studentName ?? 'Unnamed student' },
  }
}
