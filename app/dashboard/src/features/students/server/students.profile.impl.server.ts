/**
 * Server-only implementation of S-4.2 Student Profile: profile card data,
 * the enrolled-courses tab, and the activity log feed. Never import from
 * client code.
 */
import { and, asc, desc, eq, isNull, sql } from '@abugida/database'
import { courses, lessons, modules } from '@abugida/database/catalog'
import {
  awardedBadges,
  badges,
  enrollments,
  issuedCertificates,
  lessonCompletions,
  quizAttempts,
  studentTags,
} from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { requireStudentReadRole, resolveStudent } from './students.server-helpers.server'
import { mergeActivityFeed } from '../students.activity'
import type { StudentActivityItem, StudentCourseRow, StudentProfile } from '../students.types'

export async function getStudentProfileImpl(studentId: string): Promise<StudentProfile> {
  await requireStudentReadRole()
  const student = await resolveStudent(studentId)

  const [aggRows, tagRows] = await Promise.all([
    db
      .select({
        courseCount: sql<number>`COUNT(${enrollments.id}) FILTER (WHERE ${enrollments.deletedAt} IS NULL)::int`,
        completedCount: sql<number>`COUNT(${enrollments.id}) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.isCompleted})::int`,
        avgProgress: sql<
          number | null
        >`AVG(${enrollments.progressPercentage}) FILTER (WHERE ${enrollments.deletedAt} IS NULL)`,
        lastActivityAt: sql<string | null>`MAX(${enrollments.lastAccessedAt})`,
      })
      .from(enrollments)
      .where(eq(enrollments.studentId, studentId)),
    db
      .select({ tag: studentTags.tag })
      .from(studentTags)
      .where(eq(studentTags.studentId, studentId))
      .orderBy(asc(studentTags.tag)),
  ])

  const agg = aggRows.at(0)

  return {
    id: student.id,
    name: student.name ?? 'Unnamed student',
    email: student.email ?? '',
    status: student.accountStatus,
    joinedAt: student.createdAt.toISOString(),
    lastLoginAt: student.lastLoginAt ? student.lastLoginAt.toISOString() : null,
    lastActivityAt: agg?.lastActivityAt ? new Date(agg.lastActivityAt).toISOString() : null,
    phoneLast4: student.phoneNumberLast4,
    tags: tagRows.map((row) => row.tag),
    courseCount: Number(agg?.courseCount ?? 0),
    completedCount: Number(agg?.completedCount ?? 0),
    avgProgress: agg?.avgProgress == null ? null : Math.round(Number(agg.avgProgress)),
  }
}

export async function getStudentCoursesImpl(studentId: string): Promise<StudentCourseRow[]> {
  await requireStudentReadRole()
  await resolveStudent(studentId)

  const lessonTotals = db
    .select({
      courseId: modules.courseId,
      totalLessons: sql<number | null>`COUNT(${lessons.id})::int`.as('total_lessons'),
    })
    .from(modules)
    .innerJoin(lessons, and(eq(lessons.moduleId, modules.id), isNull(lessons.deletedAt)))
    .where(isNull(modules.deletedAt))
    .groupBy(modules.courseId)
    .as('lesson_totals')

  const completedTotals = db
    .select({
      courseId: lessons.courseId,
      completedLessons: sql<number | null>`COUNT(${lessonCompletions.id})::int`.as(
        'completed_lessons',
      ),
    })
    .from(lessonCompletions)
    .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
    .where(and(eq(lessonCompletions.studentId, studentId), eq(lessonCompletions.isCompleted, true)))
    .groupBy(lessons.courseId)
    .as('completed_totals')

  const rows = await db
    .select({
      enrollmentPublicId: enrollments.publicId,
      coursePublicId: courses.publicId,
      courseTitle: courses.title,
      progressPercentage: enrollments.progressPercentage,
      isCompleted: enrollments.isCompleted,
      lastAccessedAt: enrollments.lastAccessedAt,
      enrolledAt: enrollments.createdAt,
      totalLessons: lessonTotals.totalLessons,
      completedLessons: completedTotals.completedLessons,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(lessonTotals, eq(lessonTotals.courseId, courses.id))
    .leftJoin(completedTotals, eq(completedTotals.courseId, courses.id))
    .where(and(eq(enrollments.studentId, studentId), isNull(enrollments.deletedAt)))
    .orderBy(desc(enrollments.isCompleted), desc(enrollments.progressPercentage))

  return rows.map((row) => ({
    enrollmentPublicId: row.enrollmentPublicId,
    coursePublicId: row.coursePublicId,
    courseTitle: row.courseTitle,
    progressPercentage: Number(row.progressPercentage),
    isCompleted: row.isCompleted,
    completedLessons: Number(row.completedLessons ?? 0),
    totalLessons: Number(row.totalLessons ?? 0),
    lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
    enrolledAt: row.enrolledAt.toISOString(),
  }))
}

export async function getStudentActivityImpl(studentId: string): Promise<StudentActivityItem[]> {
  await requireStudentReadRole()
  await resolveStudent(studentId)

  const [enrollmentRows, completionRows, quizRows, badgeRows, certificateRows] = await Promise.all([
    db
      .select({
        id: sql<string>`'e_' || ${enrollments.publicId}::text`,
        courseTitle: courses.title,
        at: enrollments.createdAt,
      })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(and(eq(enrollments.studentId, studentId), isNull(enrollments.deletedAt)))
      .orderBy(desc(enrollments.createdAt))
      .limit(25),
    db
      .select({
        id: sql<string>`'c_' || ${lessonCompletions.publicId}::text`,
        lessonTitle: lessons.title,
        courseTitle: courses.title,
        timeSpentSeconds: lessonCompletions.timeSpentSeconds,
        at: lessonCompletions.createdAt,
      })
      .from(lessonCompletions)
      .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
      .innerJoin(courses, eq(courses.id, lessons.courseId))
      .where(eq(lessonCompletions.studentId, studentId))
      .orderBy(desc(lessonCompletions.createdAt))
      .limit(30),
    db
      .select({
        id: sql<string>`'q_' || ${quizAttempts.publicId}::text`,
        lessonTitle: lessons.title,
        courseTitle: courses.title,
        score: quizAttempts.quizScorePercentage,
        isPassed: quizAttempts.isPassed,
        at: quizAttempts.createdAt,
      })
      .from(quizAttempts)
      .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId))
      .innerJoin(courses, eq(courses.id, lessons.courseId))
      .where(eq(quizAttempts.studentId, studentId))
      .orderBy(desc(quizAttempts.createdAt))
      .limit(20),
    db
      .select({
        id: sql<string>`'b_' || ${awardedBadges.publicId}::text`,
        badgeName: badges.name,
        at: awardedBadges.awardedAt,
      })
      .from(awardedBadges)
      .innerJoin(badges, eq(badges.id, awardedBadges.badgeId))
      .where(eq(awardedBadges.studentId, studentId))
      .orderBy(desc(awardedBadges.awardedAt))
      .limit(15),
    db
      .select({
        id: sql<string>`'x_' || ${issuedCertificates.publicId}::text`,
        courseTitle: courses.title,
        at: issuedCertificates.issuedAt,
      })
      .from(issuedCertificates)
      .innerJoin(courses, eq(courses.id, issuedCertificates.courseId))
      .where(eq(issuedCertificates.studentId, studentId))
      .orderBy(desc(issuedCertificates.issuedAt))
      .limit(10),
  ])

  const rows = [
    ...enrollmentRows.map((row) => ({
      id: row.id,
      kind: 'enrolled' as const,
      title: `Enrolled in ${row.courseTitle}`,
      detail: null,
      courseTitle: row.courseTitle,
      at: row.at.toISOString(),
    })),
    ...completionRows.map((row) => ({
      id: row.id,
      kind: 'lesson_completed' as const,
      title: row.lessonTitle,
      detail:
        row.timeSpentSeconds != null && row.timeSpentSeconds > 0
          ? `${Math.round(row.timeSpentSeconds / 60)} min spent`
          : null,
      courseTitle: row.courseTitle,
      at: row.at.toISOString(),
    })),
    ...quizRows.map((row) => ({
      id: row.id,
      kind: 'quiz_attempt' as const,
      title: `Quiz — ${row.lessonTitle}`,
      detail: `${Number(row.score).toFixed(0)}% · ${row.isPassed ? 'passed' : 'not passed'}`,
      courseTitle: row.courseTitle,
      at: row.at.toISOString(),
    })),
    ...badgeRows.map((row) => ({
      id: row.id,
      kind: 'badge_awarded' as const,
      title: `Badge earned — ${row.badgeName}`,
      detail: null,
      courseTitle: null,
      at: row.at.toISOString(),
    })),
    ...certificateRows.map((row) => ({
      id: row.id,
      kind: 'certificate_issued' as const,
      title: `Certificate earned — ${row.courseTitle}`,
      detail: null,
      courseTitle: row.courseTitle,
      at: row.at.toISOString(),
    })),
  ]

  return mergeActivityFeed(rows)
}
