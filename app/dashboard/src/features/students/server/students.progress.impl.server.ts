/**
 * Server-only implementation of S-4.3 Student Progress Dashboard: overall
 * completion, streaks, time invested, per-course breakdown with trends,
 * certificates and badges. Never import from client code.
 */
import { and, asc, desc, eq, isNull, sql } from '@abugida/database'
import { courses, lessons } from '@abugida/database/catalog'
import {
  awardedBadges,
  badges,
  enrollments,
  issuedCertificates,
  lessonCompletions,
  quizAttempts,
} from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { requireStudentReadRole, resolveStudent } from './students.server-helpers.server'
import { computeStreaks, isAtRisk, toUtcDayKeys } from '../students.streak'
import type { StudentProgressCourse, StudentProgressDTO } from '../students.types'

/** Cap trend points per course to keep the payload bounded. */
const TREND_MAX_POINTS = 30

export async function getStudentProgressImpl(studentId: string): Promise<StudentProgressDTO> {
  await requireStudentReadRole()
  await resolveStudent(studentId)

  const [enrollmentRows, completionRows, quizRows, certificateRows, badgeRows] = await Promise.all([
    db
      .select({
        courseId: enrollments.courseId,
        coursePublicId: courses.publicId,
        courseTitle: courses.title,
        progressPercentage: enrollments.progressPercentage,
        isCompleted: enrollments.isCompleted,
        lastAccessedAt: enrollments.lastAccessedAt,
      })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(and(eq(enrollments.studentId, studentId), isNull(enrollments.deletedAt)))
      .orderBy(asc(courses.title)),
    db
      .select({
        courseId: lessons.courseId,
        completedAt: lessonCompletions.createdAt,
        timeSpentSeconds: lessonCompletions.timeSpentSeconds,
      })
      .from(lessonCompletions)
      .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
      .where(eq(lessonCompletions.studentId, studentId)),
    db
      .select({
        courseId: lessons.courseId,
        score: quizAttempts.quizScorePercentage,
        completedAt: quizAttempts.createdAt,
      })
      .from(quizAttempts)
      .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId))
      .where(eq(quizAttempts.studentId, studentId))
      .orderBy(desc(quizAttempts.createdAt)),
    db
      .select({
        courseTitle: courses.title,
        serial: issuedCertificates.serial,
        issuedAt: issuedCertificates.issuedAt,
      })
      .from(issuedCertificates)
      .innerJoin(courses, eq(courses.id, issuedCertificates.courseId))
      .where(eq(issuedCertificates.studentId, studentId))
      .orderBy(desc(issuedCertificates.issuedAt)),
    db
      .select({
        badgePublicId: badges.publicId,
        name: badges.name,
        icon: badges.icon,
        description: badges.description,
        source: sql<string>`${awardedBadges.source}::text`,
        awardedAt: awardedBadges.awardedAt,
      })
      .from(awardedBadges)
      .innerJoin(badges, eq(badges.id, awardedBadges.badgeId))
      .where(eq(awardedBadges.studentId, studentId))
      .orderBy(desc(awardedBadges.awardedAt)),
  ])

  // Streak math runs over every lesson-activity day (platform policy: a day
  // with any lesson activity counts toward the streak).
  const activityDays = toUtcDayKeys(completionRows.map((row) => row.completedAt))
  const todayUtc = new Date().toISOString().slice(0, 10)
  const streaks = computeStreaks(activityDays, todayUtc)

  const totalSeconds = completionRows.reduce((sum, row) => sum + (row.timeSpentSeconds ?? 0), 0)
  const lastCompletion = completionRows
    .map((row) => row.completedAt)
    .sort((a, b) => b.getTime() - a.getTime())
    .at(0)
  const lastAccess = enrollmentRows
    .map((row) => row.lastAccessedAt)
    .filter((value): value is Date => value != null)
    .sort((a, b) => b.getTime() - a.getTime())
    .at(0)
  const lastActivityAt =
    lastCompletion != null && (lastAccess == null || lastCompletion > lastAccess)
      ? lastCompletion.toISOString()
      : (lastAccess?.toISOString() ?? null)

  const completionsByCourse = new Map<number, typeof completionRows>()
  for (const row of completionRows) {
    const bucket = completionsByCourse.get(row.courseId) ?? []
    bucket.push(row)
    completionsByCourse.set(row.courseId, bucket)
  }

  const latestQuizByCourse = new Map<number, number | null>()
  for (const row of quizRows) {
    if (!latestQuizByCourse.has(row.courseId)) {
      latestQuizByCourse.set(row.courseId, Number(row.score))
    }
  }

  const coursesOut: StudentProgressCourse[] = enrollmentRows
    .map((row) => {
      const courseCompletions = completionsByCourse.get(row.courseId) ?? []
      const seconds = courseCompletions.reduce((sum, c) => sum + (c.timeSpentSeconds ?? 0), 0)
      return {
        coursePublicId: row.coursePublicId,
        courseTitle: row.courseTitle,
        progressPercentage: Number(row.progressPercentage),
        isCompleted: row.isCompleted,
        lastQuizScorePercent: latestQuizByCourse.get(row.courseId) ?? null,
        timeInvestedHours: Math.round(seconds / 360 / 10) / 10,
        trend: buildTrend(courseCompletions.map((c) => c.completedAt)),
      }
    })
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle))

  const overallCompletion =
    coursesOut.length > 0
      ? Math.round(
          coursesOut.reduce((sum, course) => sum + course.progressPercentage, 0) /
            coursesOut.length,
        )
      : null

  return {
    overallCompletion,
    currentStreakDays: streaks.current,
    longestStreakDays: streaks.longest,
    timeInvestedHours: Math.round((totalSeconds / 360) * 10) / 10,
    lastActivityAt,
    isAtRisk:
      isAtRisk(lastActivityAt, todayUtc) &&
      coursesOut.some((course) => !course.isCompleted && course.progressPercentage < 100),
    hasAnyActivity: completionRows.length > 0 || quizRows.length > 0,
    courses: coursesOut,
    certificates: certificateRows.map((row) => ({
      courseTitle: row.courseTitle,
      serial: row.serial,
      issuedAt: row.issuedAt.toISOString(),
    })),
    badges: badgeRows.map((row) => ({
      badgePublicId: row.badgePublicId,
      name: row.name,
      icon: row.icon,
      description: row.description,
      source: row.source as 'automatic' | 'manual',
      awardedAt: row.awardedAt.toISOString(),
    })),
  }
}

/** Cumulative completion count per UTC day, capped to the most recent N days. */
function buildTrend(completedAtDates: Date[]): Array<{ date: string; completed: number }> {
  const byDay = new Map<string, number>()
  for (const date of completedAtDates) {
    const key = date.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  const days = Array.from(byDay.keys()).sort().slice(-TREND_MAX_POINTS)
  let cumulative = 0
  return days.map((date) => {
    cumulative += byDay.get(date) ?? 0
    return { date, completed: cumulative }
  })
}
