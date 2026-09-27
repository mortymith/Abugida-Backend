import type { MetricAvailability, TrendSeries } from '#/features/dashboard/dashboard.types'

/** Which analytics screen a generated report belongs to (S-5.4 report types). */
export type ReportType =
  'course-performance' | 'student-progress' | 'quiz' | 'revenue' | 'cohort-comparison'

/** Downloadable file formats supported by S-5.4. */
export type ReportFormat = 'csv' | 'xlsx' | 'pdf'

/**
 * KPI card on S-5.1. `completion` is a percentage (0–100), `avgTime` is
 * fractional hours; both reuse the shared StatCard via extended formats.
 */
export interface AnalyticsKpi {
  id: 'students' | 'completion' | 'avgRating' | 'avgTime'
  label: string
  format: 'integer' | 'percent' | 'rating' | 'hours'
  value: number | null
  /** % change vs the previous equal-length period (S-5.1 MoM row). */
  deltaPct: number | null
  availability: MetricAvailability
  /** Metric definition note, surfaced as a tooltip (spec 11: explain, don't no-op). */
  note?: string
}

/** One row of the S-5.1 module breakdown table. */
export interface ModuleBreakdownRow {
  moduleId: string
  title: string
  /** Students who completed every non-deleted lesson of the module. */
  completedStudents: number
  /** completedStudents / enrolled × 100; null when the module has no lessons. */
  completionPct: number | null
  /** Mean quiz score over attempts on the module's lessons; null without attempts. */
  avgScorePct: number | null
  /** Percentage-point decline vs the previous module (module 1 vs 100). */
  dropOffPts: number | null
  /** Quiz lessons inside this module — the S-5.2 drill-down targets. */
  quizzes: Array<{ lessonId: string; title: string }>
}

/** Full payload behind S-5.1 Course Performance. */
export interface CoursePerformanceAnalytics {
  course: { courseId: string; title: string }
  range: { from: string; to: string; label: string }
  /** True when the course has no enrollments at all → screen-level empty state. */
  isEmpty: boolean
  kpis: AnalyticsKpi[]
  /** Cumulative completion-rate trend (rate as of each bucket end). */
  completionTrend: TrendSeries
  /** Distinct active students per ISO weekday (Mon..Sun). */
  weekdayActivity: {
    availability: MetricAvailability
    days: WeekdayActivityPoint[]
    note?: string
  }
  modules: ModuleBreakdownRow[]
  enrolledStudents: number
}

export interface WeekdayActivityPoint {
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday: number
  students: number
}

/** Lesson engagement detail shown in S-5.3's biggest-drop callout. */
export interface LessonEngagementRow {
  lessonId: string
  title: string
  /** Mean of per-student timeSpent/duration ratios × 100; null without durations. */
  avgWatchPct: number | null
  /** Students who completed the lesson. */
  completions: number
}

/** One horizontal bar of the S-5.3 enrollment funnel. */
export interface FunnelStep {
  label: string
  count: number
  /** count / enrolled × 100. */
  pctOfEnrolled: number
  /** Percentage-point decline vs the previous step. */
  declinePts: number
  /** Spec: flag any step-to-step decline greater than 20 points. */
  flagged: boolean
}

export interface DropOffLikelyCause {
  lessonId: string
  title: string
  avgWatchPct: number | null
}

/** Full payload behind S-5.3 Drop-off Analysis. */
export interface DropOffAnalytics {
  course: { courseId: string; title: string }
  range: { from: string; to: string; label: string }
  steps: FunnelStep[]
  /** Steepest consecutive decline (spec "Biggest Drop"); null with < 2 steps. */
  biggestDrop: { fromLabel: string; toLabel: string; declinePts: number } | null
  /** Lesson-level engagement for the module after the biggest drop. */
  likelyCauseLessons: LessonEngagementRow[]
  /** Watch-time heatmap granularity is not recorded by the platform (A3). */
  heatmapNote: string
  isEmpty: boolean
}

/** Summary line above the S-5.2 per-question table. */
export interface QuizSummary {
  attempts: number
  avgScorePct: number | null
  passRatePct: number | null
}

/** One answer choice bucket in a question's distribution. */
export interface AnswerDistributionRow {
  label: string
  count: number
  /** count / answers for the question × 100. */
  pct: number
}

/** Per-question row of the S-5.2 table (sorted worst-first by the UI). */
export interface QuizQuestionRow {
  questionId: string
  prompt: string
  /** Mean isCorrect × 100 over recorded answers; null when never answered. */
  correctPct: number | null
  /** Mean seconds between answers within an attempt (first vs startedAt). */
  avgTimeSeconds: number | null
  /** Spec: ⚠️ badge when correct % < 50. */
  flagged: boolean
  distribution: AnswerDistributionRow[]
}

/** Full payload behind S-5.2 Quiz Analytics. */
export interface QuizAnalytics {
  quiz: { lessonId: string; title: string; courseId: string; courseTitle: string }
  range: { from: string; to: string; label: string }
  summary: QuizSummary
  questions: QuizQuestionRow[]
  isEmpty: boolean
}

/** Aggregated comparison metrics for one cohort (S-5.5). */
export interface CohortComparisonColumn {
  cohortId: string
  name: string
  memberCount: number
  /** Mean enrollment progress × 100 across member enrollments. */
  avgCompletionPct: number | null
  /** Mean quiz score × 100 across member attempts. */
  avgQuizScorePct: number | null
  /** Mean weeks from enrollment creation to completion (completed only). */
  avgWeeksToFinish: number | null
}

export interface CohortComparisonMetricRow {
  metric: 'completion' | 'quizScore' | 'timeToFinish'
  label: string
  /** 'lower' means a lower value is the better outcome (time-to-finish). */
  betterDirection: 'higher' | 'lower'
  values: Array<number | null>
  /** Per-column arrow vs the previous column (null for the first column). */
  arrows: Array<boolean | null>
}

/** Full payload behind S-5.5 Cohort Comparison. */
export interface CohortComparison {
  columns: CohortComparisonColumn[]
  rows: CohortComparisonMetricRow[]
  /** Spec empty state: fewer than two cohorts exist to compare. */
  isEmpty: boolean
}

/** A generated downloadable report (S-5.4) returned by the server fn. */
export interface GeneratedReport {
  filename: string
  mimeType: string
  dataBase64: string
}

/** Lightweight course option for the S-5.4 multi-select. */
export interface ExportCourseOption {
  courseId: string
  title: string
}
