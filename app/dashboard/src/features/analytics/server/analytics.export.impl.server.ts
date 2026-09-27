/**
 * Server-only implementation of S-5.4 Export Reports. Gathers per-report-type
 * data with bulk SQL, assembles typed report sections (pure builders), and
 * renders CSV/Excel/PDF via the format module. Student-level data is only
 * included on explicit request and every path is role-gated.
 * Never import from client code.
 */
import { and, asc, eq, gte, inArray, isNull, lt, sql } from '@abugida/database'
import { courses, lessons } from '@abugida/database/catalog'
import { courseReviews, enrollments, lessonCompletions } from '@abugida/database/learning'
import { purchases } from '@abugida/database/finance'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  resolveDateRange,
  resolveTrendGranularity,
} from '#/features/dashboard/schemas/dashboard.date-range.schema'
import type { ExportReportInput } from '../schemas/analytics.schema'
import {
  canSeeRevenue,
  getSessionRole,
  NotFoundError,
  requireAnalyticsExportRole,
} from './analytics.server-helpers.server'
import { renderReport } from './analytics.export-format.server'
import { bucketEndsUTC } from '../analytics.metric-math'
import {
  buildCoursePerformanceSection,
  buildCohortComparisonSections,
  buildFunnelSection,
  buildModuleBreakdownSection,
  buildQuizSection,
  buildRevenueSection,
  buildStudentProgressSection,
} from '../analytics.export-rows'
import type {
  CoursePerformanceReportInput,
  QuizReportRow,
  ReportSection,
  RevenueReportRow,
  StudentProgressReportRow,
} from '../analytics.export-rows'
import type { ExportCourseOption, GeneratedReport } from '../analytics.types'
import { loadCohortComparison } from './analytics.cohorts.impl.server'
import { loadDropOffAnalytics } from './analytics.drop-off.impl.server'
import { loadQuizAnalytics } from './analytics.quiz.impl.server'

type ResolvedCourse = { id: number; publicId: string; title: string }

/** Safety cap for per-student export rows (documented known limitation). */
const STUDENT_ROW_CAP = 20_000

/** Course options for the S-5.4 multi-select (any non-deleted course). */
export async function listExportCourses(): Promise<ExportCourseOption[]> {
  await requireAnalyticsExportRole()
  const rows = await db
    .select({ courseId: courses.publicId, title: courses.title })
    .from(courses)
    .where(isNull(courses.deletedAt))
    .orderBy(asc(courses.title))
    .limit(200)
  return rows
}

async function resolveSelectedCourses(coursePublicIds: string[]): Promise<ResolvedCourse[]> {
  if (coursePublicIds.length === 0) {
    return db
      .select({ id: courses.id, publicId: courses.publicId, title: courses.title })
      .from(courses)
      .where(and(isNull(courses.deletedAt), eq(courses.status, 'published')))
      .orderBy(asc(courses.title))
      .limit(50)
  }
  return db
    .select({ id: courses.id, publicId: courses.publicId, title: courses.title })
    .from(courses)
    .where(and(inArray(courses.publicId, coursePublicIds), isNull(courses.deletedAt)))
    .orderBy(asc(courses.title))
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null
}

// ── Course performance (+ single-course module/funnel detail) ─────────────

async function coursePerformanceSections(
  input: ExportReportInput,
  selected: ResolvedCourse[],
  revenueAllowed: boolean,
): Promise<ReportSection[]> {
  if (selected.length === 0) return []
  const range = resolveDateRange(input)
  const courseIds = selected.map((course) => course.id)

  const enrollmentStats = await db
    .select({
      courseId: enrollments.courseId,
      enrolledCurrent: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.createdAt} >= ${range.from} AND ${enrollments.createdAt} < ${range.to})::int`,
      completedTotal: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.isCompleted})::int`,
      enrolledTotal: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL)::int`,
    })
    .from(enrollments)
    .where(inArray(enrollments.courseId, courseIds))
    .groupBy(enrollments.courseId)

  const ratingStats = await db
    .select({
      courseId: courseReviews.courseId,
      avgRating: sql<string | null>`AVG(${courseReviews.rating})`,
    })
    .from(courseReviews)
    .where(
      and(
        inArray(courseReviews.courseId, courseIds),
        isNull(courseReviews.deletedAt),
        gte(courseReviews.createdAt, range.from),
        lt(courseReviews.createdAt, range.to),
      ),
    )
    .groupBy(courseReviews.courseId)

  const timeStats = await db
    .select({
      courseId: lessons.courseId,
      seconds: sql<number>`COALESCE(SUM(${lessonCompletions.timeSpentSeconds}), 0)::int`,
      students: sql<number>`COUNT(DISTINCT ${lessonCompletions.studentId})::int`,
    })
    .from(lessonCompletions)
    .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
    .where(
      and(
        inArray(lessons.courseId, courseIds),
        eq(lessonCompletions.isCompleted, true),
        gte(lessonCompletions.completedAt, range.from),
        lt(lessonCompletions.completedAt, range.to),
      ),
    )
    .groupBy(lessons.courseId)

  let revenueByCourse = new Map<number, number>()
  if (revenueAllowed) {
    const rows = await db
      .select({
        courseId: purchases.courseId,
        revenue: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
      })
      .from(purchases)
      .where(
        and(
          inArray(purchases.courseId, courseIds),
          eq(purchases.status, 'completed'),
          isNull(purchases.deletedAt),
          gte(purchases.completedAt, range.from),
          lt(purchases.completedAt, range.to),
        ),
      )
      .groupBy(purchases.courseId)
    revenueByCourse = new Map<number, number>(
      rows.flatMap((row) =>
        row.courseId == null ? [] : [[row.courseId, Number(row.revenue)] as const],
      ),
    )
  }

  const enrollmentsBy = new Map(enrollmentStats.map((row) => [row.courseId, row]))
  const ratingsBy = new Map(ratingStats.map((row) => [row.courseId, row.avgRating]))
  const timeBy = new Map(timeStats.map((row) => [row.courseId, row]))

  const reportRows: CoursePerformanceReportInput[] = selected.map((course) => {
    const stats = enrollmentsBy.get(course.id)
    const time = timeBy.get(course.id)
    const avgHours =
      time && time.students > 0
        ? Math.round((Number(time.seconds) / 3600 / time.students) * 100) / 100
        : null
    const completionPct =
      stats && stats.enrolledTotal > 0
        ? Math.round((stats.completedTotal / stats.enrolledTotal) * 10_000) / 100
        : null
    const rating = ratingsBy.get(course.id)
    return {
      title: course.title,
      students: stats?.enrolledCurrent ?? 0,
      completionPct,
      avgRating: rating != null ? Number(rating) : null,
      avgTimeHours: avgHours,
      revenue: revenueAllowed ? (revenueByCourse.get(course.id) ?? 0) : null,
    }
  })

  const sections: ReportSection[] = [buildCoursePerformanceSection(reportRows)]

  // Single-course selections get the S-5.3 funnel and S-5.1 module breakdown
  // as detail sections, so one export covers the course report use case.
  if (selected.length === 1) {
    const dropOff = await loadDropOffAnalytics(selected[0].publicId, input)
    sections.push(buildFunnelSection(dropOff.course.title, dropOff.steps))
    sections.push(buildModuleBreakdownSection(dropOff.course.title, dropOffModuleRows(dropOff)))
  }
  return sections
}

// The drop-off payload carries funnel counts per module; the module breakdown
// section reuses the S-5.1 table shape, so derive it from the same source.
function dropOffModuleRows(dropOff: Awaited<ReturnType<typeof loadDropOffAnalytics>>) {
  return dropOff.steps
    .filter((step) => step.label !== 'Enrolled' && step.label !== 'Completed')
    .map((step) => ({
      moduleId: step.label,
      title: step.label,
      completedStudents: step.count,
      completionPct: step.pctOfEnrolled,
      avgScorePct: null,
      dropOffPts: step.declinePts,
      quizzes: [],
    }))
}

// ── Student progress ───────────────────────────────────────────────────────

async function studentProgressSections(selected: ResolvedCourse[]): Promise<ReportSection[]> {
  if (selected.length === 0) return []
  const courseIds = selected.map((course) => course.id)
  const rows = await db
    .select({
      courseTitle: courses.title,
      studentName: users.name,
      studentEmail: users.email,
      progressPct: enrollments.progressPercentage,
      isCompleted: enrollments.isCompleted,
      completedAt: enrollments.completedAt,
      lastAccessedAt: enrollments.lastAccessedAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(and(inArray(enrollments.courseId, courseIds), isNull(enrollments.deletedAt)))
    .orderBy(asc(courses.title), asc(users.name))
    .limit(STUDENT_ROW_CAP)

  const progressRows: StudentProgressReportRow[] = rows.map((row) => ({
    course: row.courseTitle,
    student: row.studentName
      ? `${row.studentName} (${row.studentEmail})`
      : (row.studentEmail ?? 'Unknown student'),
    progressPct: Number(row.progressPct),
    isCompleted: row.isCompleted,
    completedAt: iso(row.completedAt),
    lastAccessedAt: iso(row.lastAccessedAt),
  }))
  return [buildStudentProgressSection(progressRows)]
}

// ── Quiz analytics ─────────────────────────────────────────────────────────

async function quizSections(
  input: ExportReportInput,
  selected: ResolvedCourse[],
): Promise<ReportSection[]> {
  if (selected.length === 0) return []
  const sections: ReportSection[] = []
  const quizRows: QuizReportRow[] = []
  // Per-quiz aggregation is several queries each; cap the fan-out so an
  // "all published courses" selection cannot explode into thousands of runs.
  const QUIZ_CAP = 100

  outer: for (const course of selected) {
    const quizLessons = await db
      .select({ lessonId: lessons.publicId, title: lessons.title })
      .from(lessons)
      .where(
        and(
          eq(lessons.courseId, course.id),
          isNull(lessons.deletedAt),
          sql`EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.lesson_id = ${lessons.id})`,
        ),
      )
      .limit(100)

    for (const quizLesson of quizLessons) {
      if (quizRows.length >= QUIZ_CAP) break outer
      const analytics = await loadQuizAnalytics(course.publicId, quizLesson.lessonId, input)
      quizRows.push({
        course: course.title,
        quiz: analytics.quiz.title,
        attempts: analytics.summary.attempts,
        avgScorePct: analytics.summary.avgScorePct,
        passRatePct: analytics.summary.passRatePct,
      })
      // A pinned quiz lesson (from S-5.2) exports the per-question detail too.
      if (input.lessonId != null && input.lessonId === quizLesson.lessonId) {
        sections.push(
          {
            title: `Quiz Summary — ${analytics.quiz.title}`,
            columns: ['Attempts', 'Avg Score %', 'Pass Rate %'],
            rows: [
              [
                analytics.summary.attempts,
                analytics.summary.avgScorePct,
                analytics.summary.passRatePct,
              ],
            ],
          },
          {
            title: 'Per-Question Breakdown',
            columns: ['Question', 'Correct %', 'Avg Time (s)', 'Flagged'],
            rows: analytics.questions.map((question) => [
              question.prompt,
              question.correctPct,
              question.avgTimeSeconds,
              question.flagged ? '!' : '',
            ]),
          },
        )
      }
    }
  }
  if (quizRows.length > 0) sections.unshift(buildQuizSection(quizRows))
  return sections
}

// ── Revenue ────────────────────────────────────────────────────────────────

async function revenueSections(
  input: ExportReportInput,
  selected: ResolvedCourse[],
  includeStudentLevel: boolean,
): Promise<ReportSection[]> {
  if (selected.length === 0) return []
  const range = resolveDateRange(input)
  const courseIds = selected.map((course) => course.id)

  const grouped = await db
    .select({
      courseId: purchases.courseId,
      transactions: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
    })
    .from(purchases)
    .where(
      and(
        inArray(purchases.courseId, courseIds),
        eq(purchases.status, 'completed'),
        isNull(purchases.deletedAt),
        gte(purchases.completedAt, range.from),
        lt(purchases.completedAt, range.to),
      ),
    )
    .groupBy(purchases.courseId)
  const byCourse = new Map(grouped.map((row) => [row.courseId, row]))

  const sections: ReportSection[] = [
    buildRevenueSection(
      selected.map((course): RevenueReportRow => ({
        course: course.title,
        transactions: byCourse.get(course.id)?.transactions ?? 0,
        revenue: Number(byCourse.get(course.id)?.revenue ?? 0),
      })),
    ),
  ]

  if (includeStudentLevel) {
    const rows = await db
      .select({
        courseTitle: courses.title,
        studentName: users.name,
        studentEmail: users.email,
        amount: purchases.amount,
        completedAt: purchases.completedAt,
      })
      .from(purchases)
      .innerJoin(courses, eq(courses.id, purchases.courseId))
      .innerJoin(users, eq(users.id, purchases.studentId))
      .where(
        and(
          inArray(purchases.courseId, courseIds),
          eq(purchases.status, 'completed'),
          isNull(purchases.deletedAt),
          gte(purchases.completedAt, range.from),
          lt(purchases.completedAt, range.to),
        ),
      )
      .orderBy(asc(purchases.completedAt))
      .limit(STUDENT_ROW_CAP)
    sections.push({
      title: 'Purchases (student level)',
      columns: ['Course', 'Student', 'Amount', 'Completed At'],
      rows: rows.map((row) => [
        row.courseTitle,
        row.studentName ? `${row.studentName} (${row.studentEmail})` : row.studentEmail,
        Number(row.amount),
        iso(row.completedAt),
      ]),
    })
  }
  return sections
}

// ── Aggregated charts detail ───────────────────────────────────────────────

async function aggregatedChartSections(
  input: ExportReportInput,
  selected: ResolvedCourse[],
): Promise<ReportSection[]> {
  if (selected.length === 0) return []
  const range = resolveDateRange(input)
  const granularity = resolveTrendGranularity(range)
  const courseIds = selected.map((course) => course.id)

  const createdRows = await db
    .select({
      bucket: sql<string>`date_trunc(${granularity}, ${enrollments.createdAt})::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.courseId, courseIds),
        isNull(enrollments.deletedAt),
        gte(enrollments.createdAt, range.from),
        lt(enrollments.createdAt, range.to),
      ),
    )
    .groupBy(sql`1`)
  const completedRows = await db
    .select({
      bucket: sql<string>`date_trunc(${granularity}, ${enrollments.completedAt})::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.courseId, courseIds),
        isNull(enrollments.deletedAt),
        gte(enrollments.completedAt, range.from),
        lt(enrollments.completedAt, range.to),
      ),
    )
    .groupBy(sql`1`)

  const createdBy = new Map(createdRows.map((row) => [row.bucket.slice(0, 10), row.count]))
  const completedBy = new Map(completedRows.map((row) => [row.bucket.slice(0, 10), row.count]))
  const buckets = bucketEndsUTC(range.from, range.to, granularity)
  const sections: ReportSection[] = [
    {
      title: 'Enrollments per bucket (aggregated)',
      columns: ['Bucket', 'New Enrollments', 'Completions'],
      rows: buckets.map((end) => {
        const key = new Date(end.getTime() - 1).toISOString().slice(0, 10)
        return [key, createdBy.get(key) ?? 0, completedBy.get(key) ?? 0]
      }),
    },
  ]
  return sections
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function generateAnalyticsReport(input: ExportReportInput): Promise<GeneratedReport> {
  const userId = await requireAnalyticsExportRole()
  const role = await getSessionRole()
  const revenueAllowed = canSeeRevenue(role)
  if (input.reportType === 'revenue' && !revenueAllowed) {
    throw new Error('FORBIDDEN')
  }

  const range = resolveDateRange(input)
  const selected = await resolveSelectedCourses(input.courseIds)
  const metaLines = [
    `Period: ${range.label}`,
    `Courses: ${selected.length === 0 ? 'all published' : selected.map((course) => course.title).join(', ')}`,
    `Generated for user ${userId}`,
    input.includeStudentLevelData ? 'Includes student-level data' : 'Aggregated only',
  ]

  let sections: ReportSection[]
  switch (input.reportType) {
    case 'course-performance': {
      sections = await coursePerformanceSections(input, selected, revenueAllowed)
      if (input.includeStudentLevelData) {
        sections.push(...(await studentProgressSections(selected)))
      }
      break
    }
    case 'student-progress': {
      sections = await studentProgressSections(selected)
      break
    }
    case 'quiz': {
      sections = await quizSections(input, selected)
      break
    }
    case 'revenue': {
      sections = await revenueSections(input, selected, input.includeStudentLevelData)
      break
    }
    case 'cohort-comparison': {
      const comparison = await loadCohortComparison(input.cohortIds ?? [])
      sections = buildCohortComparisonSections(comparison)
      break
    }
  }

  if (input.includeAggregatedCharts && input.reportType !== 'cohort-comparison') {
    sections.push(...(await aggregatedChartSections(input, selected)))
  }

  if (sections.length === 0) {
    throw new NotFoundError('No data available for the requested report')
  }

  return renderReport(
    input.reportType,
    input.format,
    'Abugida Academy — Analytics Report',
    metaLines,
    sections,
  )
}
