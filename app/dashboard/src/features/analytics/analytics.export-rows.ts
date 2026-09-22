/**
 * Pure report row builders for S-5.4 Export Reports. Each builder maps a
 * typed analytics payload (or plain input rows) into export sections so the
 * CSV/Excel/PDF generators share one definition of what a report contains.
 * Metric semantics mirror the on-screen S-5.x definitions.
 */
import type { CohortComparison, FunnelStep, ModuleBreakdownRow } from './analytics.types'
import type { TrendPoint } from '#/features/dashboard/dashboard.types'

export interface ReportSection {
  title: string
  columns: string[]
  rows: Array<Array<string | number | null>>
}

export interface CoursePerformanceReportInput {
  title: string
  students: number
  completionPct: number | null
  avgRating: number | null
  avgTimeHours: number | null
  /** Only populated for roles with revenue access. */
  revenue: number | null
}

/** S-5.4 "Course Performance": one row per selected course. */
export function buildCoursePerformanceSection(
  courses: CoursePerformanceReportInput[],
): ReportSection {
  const columns = [
    'Course',
    'Students',
    'Completion %',
    'Avg Rating',
    'Avg Time (hrs)',
    ...(courses.some((course) => course.revenue != null) ? ['Revenue'] : []),
  ]
  return {
    title: 'Course Performance',
    columns,
    rows: courses.map((course) => [
      course.title,
      course.students,
      course.completionPct,
      course.avgRating,
      course.avgTimeHours,
      ...(columns.length > 5 ? [course.revenue] : []),
    ]),
  }
}

export interface StudentProgressReportRow {
  course: string
  student: string
  progressPct: number
  isCompleted: boolean
  completedAt: string | null
  lastAccessedAt: string | null
}

/** S-5.4 "Student Progress" (+ the student-level section of other reports). */
export function buildStudentProgressSection(rows: StudentProgressReportRow[]): ReportSection {
  return {
    title: 'Student Progress',
    columns: ['Course', 'Student', 'Progress %', 'Completed', 'Completed At', 'Last Accessed'],
    rows: rows.map((row) => [
      row.course,
      row.student,
      row.progressPct,
      row.isCompleted ? 'Yes' : 'No',
      row.completedAt,
      row.lastAccessedAt,
    ]),
  }
}

export interface QuizReportRow {
  course: string
  quiz: string
  attempts: number
  avgScorePct: number | null
  passRatePct: number | null
}

/** S-5.4 "Quiz Analytics": one row per quiz lesson in the selection. */
export function buildQuizSection(rows: QuizReportRow[]): ReportSection {
  return {
    title: 'Quiz Analytics',
    columns: ['Course', 'Quiz', 'Attempts', 'Avg Score %', 'Pass Rate %'],
    rows: rows.map((row) => [row.course, row.quiz, row.attempts, row.avgScorePct, row.passRatePct]),
  }
}

export interface RevenueReportRow {
  course: string
  transactions: number
  revenue: number
}

/** S-5.4 "Revenue Report": completed purchases grouped by course. */
export function buildRevenueSection(rows: RevenueReportRow[]): ReportSection {
  return {
    title: 'Revenue Report',
    columns: ['Course', 'Transactions', 'Revenue'],
    rows: rows.map((row) => [row.course, row.transactions, row.revenue]),
  }
}

/** S-5.4 cohort-comparison export: metric rows × cohort columns. */
export function buildCohortComparisonSections(comparison: CohortComparison): ReportSection[] {
  const header = ['Metric', ...comparison.columns.map((column) => column.name)]
  const memberRow: ReportSection = {
    title: 'Cohort Comparison',
    columns: header,
    rows: [
      ['Members', ...comparison.columns.map((column) => column.memberCount)],
      ...comparison.rows.map((row) => [row.label, ...row.values]),
    ],
  }
  return [memberRow]
}

/** S-5.4 detail exports of on-screen tables (spec: charts expose a data table). */
export function buildModuleBreakdownSection(
  courseTitle: string,
  rows: ModuleBreakdownRow[],
): ReportSection {
  return {
    title: `Module Breakdown — ${courseTitle}`,
    columns: ['Module', 'Students Completed', 'Completion %', 'Avg Score %', 'Drop-off (pts)'],
    rows: rows.map((row) => [
      row.title,
      row.completedStudents,
      row.completionPct,
      row.avgScorePct,
      row.dropOffPts,
    ]),
  }
}

/** Funnel table for the drop-off report/extras. */
export function buildFunnelSection(courseTitle: string, steps: FunnelStep[]): ReportSection {
  return {
    title: `Enrollment Funnel — ${courseTitle}`,
    columns: ['Step', 'Students', '% of Enrolled', 'Decline (pts)', 'Flagged'],
    rows: steps.map((step) => [
      step.label,
      step.count,
      step.pctOfEnrolled,
      step.declinePts,
      step.flagged ? '⚠' : '',
    ]),
  }
}

/**
 * "Include aggregated charts" detail: the trend series as a data table
 * (bucket label + value). Kept generic so any TrendSeries can export.
 */
export function buildTrendSection(
  title: string,
  points: TrendPoint[],
  unit: string,
): ReportSection {
  return {
    title,
    columns: ['Bucket', unit],
    rows: points.map((point) => [point.date, point.value]),
  }
}
