/**
 * Server-only implementation of S-5.1 Course Performance analytics.
 * Aggregation happens in Postgres (COUNT/AVG FILTER, GROUP BY, date_trunc);
 * this module fetches shaped inputs and delegates the math to the pure
 * `analytics.metric-math` module. Never import from client code.
 */
import { and, eq, isNull, sql } from '@abugida/database'
import { lessons, modules } from '@abugida/database/catalog'
import {
  courseReviews,
  enrollments,
  lessonCompletions,
  quizAttempts,
  quizQuestions,
} from '@abugida/database/learning'
import { db } from '#/config/db.config'
import {
  resolveDateRange,
  resolveTrendGranularity,
} from '#/features/dashboard/schemas/dashboard.date-range.schema'
import type { AnalyticsRangeInput } from '../schemas/analytics.schema'
import { resolveCourse, getSessionRole } from './analytics.server-helpers.server'
import {
  averageHoursPerStudent,
  buildCompletionTrend,
  buildModuleRows,
  kpi,
  pctDelta,
} from '../analytics.metric-math'
import type {
  AnalyticsKpi,
  CoursePerformanceAnalytics,
  ModuleBreakdownRow,
} from '../analytics.types'

export async function loadCoursePerformanceAnalytics(
  coursePublicId: string,
  input: AnalyticsRangeInput,
): Promise<CoursePerformanceAnalytics> {
  await getSessionRole()
  const course = await resolveCourse(coursePublicId)
  const range = resolveDateRange(input)
  const { from, to, prevFrom, prevTo } = range
  const courseId = course.id

  // ── One grouped pass over enrollments for every enrollment-derived number ──
  const enrollmentStatsRows = await db
    .select({
      enrolledTotal: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL)::int`,
      enrolledCurrent: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.createdAt} >= ${from} AND ${enrollments.createdAt} < ${to})::int`,
      enrolledPrevious: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.createdAt} >= ${prevFrom} AND ${enrollments.createdAt} < ${prevTo})::int`,
      completedTotal: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.isCompleted})::int`,
      completedBeforePrevEnd: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.isCompleted} AND ${enrollments.completedAt} < ${prevTo} AND ${enrollments.createdAt} < ${prevTo})::int`,
      enrolledBeforePrevEnd: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.createdAt} < ${prevTo})::int`,
      baseCreated: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.createdAt} < ${from})::int`,
      baseCompleted: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.isCompleted} AND ${enrollments.completedAt} < ${from})::int`,
    })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
  const enrollmentStats = enrollmentStatsRows.at(0)

  // ── Bucketed trend inputs (created/completed instants inside the range) ──
  const granularity = resolveTrendGranularity(range)
  const truncUnit = granularity
  const createdAtBuckets = await db
    .select({
      bucket: sql<string>`date_trunc(${truncUnit}, ${enrollments.createdAt})::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        isNull(enrollments.deletedAt),
        sql`${enrollments.createdAt} >= ${from}`,
      ),
    )
    .groupBy(sql`1`)
  const completedAtBuckets = await db
    .select({
      bucket: sql<string>`date_trunc(${truncUnit}, ${enrollments.completedAt})::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        isNull(enrollments.deletedAt),
        sql`${enrollments.completedAt} >= ${from} AND ${enrollments.completedAt} < ${to}`,
      ),
    )
    .groupBy(sql`1`)

  // Bucket rows are (bucket-start, count); expand to instants for the pure
  // cumulative fold — one synthetic instant per counted enrollment.
  const createdAts: Date[] = []
  for (const row of createdAtBuckets) {
    for (let i = 0; i < row.count; i += 1) createdAts.push(new Date(row.bucket))
  }
  const completedAts: Date[] = []
  for (const row of completedAtBuckets) {
    for (let i = 0; i < row.count; i += 1) completedAts.push(new Date(row.bucket))
  }

  const completionTrend = buildCompletionTrend(from, to, granularity, {
    baseCreated: enrollmentStats?.baseCreated ?? 0,
    baseCompleted: enrollmentStats?.baseCompleted ?? 0,
    createdAts,
    completedAts,
  })

  // ── Reviews → Avg Rating (current + previous period) ──
  const ratingStatsRows = await db
    .select({
      avgCurrent: sql<
        string | null
      >`AVG(${courseReviews.rating}) FILTER (WHERE ${courseReviews.createdAt} >= ${from} AND ${courseReviews.createdAt} < ${to})`,
      countCurrent: sql<number>`COUNT(*) FILTER (WHERE ${courseReviews.createdAt} >= ${from} AND ${courseReviews.createdAt} < ${to})::int`,
      avgPrevious: sql<
        string | null
      >`AVG(${courseReviews.rating}) FILTER (WHERE ${courseReviews.createdAt} >= ${prevFrom} AND ${courseReviews.createdAt} < ${prevTo})`,
    })
    .from(courseReviews)
    .where(and(eq(courseReviews.courseId, courseId), isNull(courseReviews.deletedAt)))
  const ratingStats = ratingStatsRows.at(0)

  // ── Time spent → Avg Time (current + previous period) ──
  const timeStatsRows = await db
    .select({
      secondsCurrent: sql<number>`COALESCE(SUM(${lessonCompletions.timeSpentSeconds}) FILTER (WHERE ${lessonCompletions.completedAt} >= ${from} AND ${lessonCompletions.completedAt} < ${to}), 0)::int`,
      studentsCurrent: sql<number>`COUNT(DISTINCT ${lessonCompletions.studentId}) FILTER (WHERE ${lessonCompletions.completedAt} >= ${from} AND ${lessonCompletions.completedAt} < ${to})::int`,
      secondsPrevious: sql<number>`COALESCE(SUM(${lessonCompletions.timeSpentSeconds}) FILTER (WHERE ${lessonCompletions.completedAt} >= ${prevFrom} AND ${lessonCompletions.completedAt} < ${prevTo}), 0)::int`,
      studentsPrevious: sql<number>`COUNT(DISTINCT ${lessonCompletions.studentId}) FILTER (WHERE ${lessonCompletions.completedAt} >= ${prevFrom} AND ${lessonCompletions.completedAt} < ${prevTo})::int`,
    })
    .from(lessonCompletions)
    .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
    .where(and(eq(lessons.courseId, courseId), eq(lessonCompletions.isCompleted, true)))
  const timeStats = timeStatsRows.at(0)

  // ── Weekday activity: completions + quiz attempts, distinct students ──
  const weekdayRows = await db
    .select({
      weekday: sql<number>`EXTRACT(ISODOW FROM ${lessonCompletions.completedAt})::int`,
      students: sql<number>`COUNT(DISTINCT ${lessonCompletions.studentId})::int`,
    })
    .from(lessonCompletions)
    .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessonCompletions.isCompleted, true),
        sql`${lessonCompletions.completedAt} >= ${from} AND ${lessonCompletions.completedAt} < ${to}`,
      ),
    )
    .groupBy(sql`1`)
  const quizWeekdayRows = await db
    .select({
      weekday: sql<number>`EXTRACT(ISODOW FROM ${quizAttempts.startedAt})::int`,
      students: sql<number>`COUNT(DISTINCT ${quizAttempts.studentId})::int`,
    })
    .from(quizAttempts)
    .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId))
    .where(
      and(
        eq(lessons.courseId, courseId),
        sql`${quizAttempts.startedAt} >= ${from} AND ${quizAttempts.startedAt} < ${to}`,
      ),
    )
    .groupBy(sql`1`)
  // Distinct-set merge: a student active through both event kinds counts once
  // per weekday, so each day takes the max of the two distinct-set sizes
  // (never double-counts a single-source student; two simple GROUP BY queries
  // instead of one UNION with a redundant join).
  const weekdayMap = new Map<number, number>()
  for (const row of [...weekdayRows, ...quizWeekdayRows]) {
    weekdayMap.set(row.weekday, Math.max(weekdayMap.get(row.weekday) ?? 0, row.students))
  }
  const weekdayActivity = Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    students: weekdayMap.get(index + 1) ?? 0,
  }))

  // ── Module breakdown ──
  const enrolledTotal = enrollmentStats?.enrolledTotal ?? 0
  const moduleRows = await db
    .select({
      internalId: modules.id,
      moduleId: modules.publicId,
      title: modules.title,
      lessonCount: sql<number>`(SELECT COUNT(*) FROM ${lessons} l WHERE l.module_id = ${modules.id} AND l.deleted_at IS NULL)::int`,
      completedStudents: sql<number>`(
        SELECT COUNT(*)::int FROM (
          SELECT lc.student_id
          FROM ${lessonCompletions} lc
          JOIN ${lessons} l ON l.id = lc.lesson_id
          WHERE l.module_id = ${modules.id}
            AND l.deleted_at IS NULL
            AND lc.is_completed
          GROUP BY lc.student_id
          HAVING COUNT(DISTINCT lc.lesson_id) =
            (SELECT COUNT(*) FROM ${lessons} l2 WHERE l2.module_id = ${modules.id} AND l2.deleted_at IS NULL)
        ) completers
      )`,
      avgScorePct: sql<string | null>`(
        SELECT ROUND(AVG(qa.quiz_score_percentage)::numeric, 2)::text
        FROM ${quizAttempts} qa
        JOIN ${lessons} l3 ON l3.id = qa.lesson_id
        WHERE l3.module_id = ${modules.id} AND qa.completed_at IS NOT NULL
      )`,
    })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
    .orderBy(modules.sortOrder)

  const quizLessonRows = await db
    .select({ lessonId: lessons.publicId, title: lessons.title, moduleId: lessons.moduleId })
    .from(lessons)
    .where(
      and(
        eq(lessons.courseId, courseId),
        isNull(lessons.deletedAt),
        sql`EXISTS (SELECT 1 FROM ${quizQuestions} qq WHERE qq.lesson_id = ${lessons.id})`,
      ),
    )
    .orderBy(lessons.sortOrder)

  const quizzesByInternalModule = new Map<number, Array<{ lessonId: string; title: string }>>()
  for (const row of quizLessonRows) {
    const list = quizzesByInternalModule.get(row.moduleId) ?? []
    list.push({ lessonId: row.lessonId, title: row.title })
    quizzesByInternalModule.set(row.moduleId, list)
  }

  const moduleBreakdown: ModuleBreakdownRow[] = buildModuleRows(
    moduleRows.map((row) => ({
      moduleId: row.moduleId,
      title: row.title,
      lessonCount: row.lessonCount,
      completedStudents: row.completedStudents,
      avgScorePct: row.avgScorePct == null ? null : Number(row.avgScorePct),
      quizzes: quizzesByInternalModule.get(row.internalId) ?? [],
    })),
    enrolledTotal,
  )

  // ── KPI cards ──
  const enrolledCurrent = enrollmentStats?.enrolledCurrent ?? 0
  const enrolledPrevious = enrollmentStats?.enrolledPrevious ?? 0
  const completedTotal = enrollmentStats?.completedTotal ?? 0
  const completionRate =
    enrolledTotal > 0 ? Math.round((completedTotal / enrolledTotal) * 10_000) / 100 : null
  const prevEnrolled = enrollmentStats?.enrolledBeforePrevEnd ?? 0
  const completionPrev =
    prevEnrolled > 0
      ? Math.round(((enrollmentStats?.completedBeforePrevEnd ?? 0) / prevEnrolled) * 10_000) / 100
      : null

  const avgRating =
    ratingStats?.avgCurrent != null ? Math.round(Number(ratingStats.avgCurrent) * 100) / 100 : null
  const avgRatingDelta =
    ratingStats?.avgCurrent != null && ratingStats.avgPrevious != null
      ? Math.round((Number(ratingStats.avgCurrent) - Number(ratingStats.avgPrevious)) * 100) / 100
      : null

  const avgHours = averageHoursPerStudent(
    timeStats?.secondsCurrent ?? 0,
    timeStats?.studentsCurrent ?? 0,
  )
  const avgHoursPrev = averageHoursPerStudent(
    timeStats?.secondsPrevious ?? 0,
    timeStats?.studentsPrevious ?? 0,
  )

  const kpis: AnalyticsKpi[] = [
    kpi(
      'students',
      'Students',
      'integer',
      enrolledCurrent,
      pctDelta(enrolledCurrent, enrolledPrevious),
      enrolledTotal === 0 ? 'no_data' : 'ok',
      'Distinct new enrollments in the selected period.',
    ),
    kpi(
      'completion',
      'Completion',
      'percent',
      completionRate,
      completionRate != null && completionPrev != null
        ? Math.round((completionRate - completionPrev) * 100) / 100
        : null,
      enrolledTotal === 0 ? 'no_data' : 'ok',
      'Completed enrollments ÷ total enrollments (all-time). Delta vs the end of the previous period.',
    ),
    kpi(
      'avgRating',
      'Avg Rating',
      'rating',
      avgRating,
      avgRatingDelta,
      (ratingStats?.countCurrent ?? 0) === 0 ? 'no_data' : 'ok',
      'Mean review rating (1–5) for reviews created in the selected period.',
    ),
    kpi(
      'avgTime',
      'Avg Time',
      'hours',
      avgHours,
      avgHours != null && avgHoursPrev != null
        ? Math.round((avgHours - avgHoursPrev) * 100) / 100
        : null,
      (timeStats?.studentsCurrent ?? 0) === 0 ? 'no_data' : 'ok',
      'Recorded learning time per active student (hours) within the selected period.',
    ),
  ]

  return {
    course: { courseId: course.publicId, title: course.title },
    range: { from: from.toISOString(), to: to.toISOString(), label: range.label },
    isEmpty: enrolledTotal === 0,
    kpis,
    completionTrend: {
      availability: completionTrend.length === 0 ? 'no_data' : 'ok',
      granularity,
      points: completionTrend,
      note: 'Cumulative completion rate (completed ÷ enrolled) as of each point.',
    },
    weekdayActivity: {
      availability: weekdayActivity.some((day) => day.students > 0) ? 'ok' : 'no_data',
      days: weekdayActivity,
      note: 'Distinct students with a lesson completion or quiz attempt, per weekday (UTC).',
    },
    modules: moduleBreakdown,
    enrolledStudents: enrolledTotal,
  }
}
