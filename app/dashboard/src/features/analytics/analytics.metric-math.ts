/**
 * Pure analytics math for spec 07 (S-5.1 – S-5.5).
 *
 * Every function here is deterministic and database-free so it can be unit
 * tested against hand-computed fixtures; the `*.impl.server.ts` modules only
 * fetch inputs and delegate. All date math is UTC (spec 11 has no TZ
 * override; matches the shared date-range module).
 */
import type {
  AnswerDistributionRow,
  AnalyticsKpi,
  CohortComparisonColumn,
  CohortComparisonMetricRow,
  FunnelStep,
  LessonEngagementRow,
  ModuleBreakdownRow,
  QuizQuestionRow,
  QuizSummary,
  WeekdayActivityPoint,
} from './analytics.types'
import type { TrendPoint } from '#/features/dashboard/dashboard.types'
import { formatTrendBucket } from '#/features/dashboard/schemas/dashboard.date-range.schema'
import type { TrendGranularity } from '#/features/dashboard/schemas/dashboard.date-range.schema'

/** 20-point step-to-step decline threshold (S-5.3 steep-drop flag). */
export const FUNNEL_FLAG_THRESHOLD_PTS = 20
/** Correct-rate threshold for the S-5.2 ⚠️ badge. */
export const QUESTION_FLAG_THRESHOLD_PCT = 50

/** % change vs a previous period; null when the previous is 0/absent. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function startOfDayUTC(date: Date): Date {
  const next = new Date(date)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

/**
 * Bucket boundaries (exclusive ends) covering [from, to) at the given
 * granularity, aligned to UTC calendar units. 12-month ranges align to month
 * starts, week ranges to Mondays, day ranges to UTC midnight.
 */
export function bucketEndsUTC(from: Date, to: Date, granularity: TrendGranularity): Date[] {
  const ends: Date[] = []
  if (granularity === 'month') {
    const cursor = startOfDayUTC(from)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1)
    cursor.setUTCHours(0, 0, 0, 0)
    while (cursor.getTime() <= to.getTime()) {
      ends.push(new Date(cursor))
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
    return ends
  }

  const stepMs = granularity === 'week' ? 7 * 86_400_000 : 86_400_000
  const cursor = startOfDayUTC(from)
  if (granularity === 'week') {
    // Advance to the next Monday after `from` (ISO weekday 1 = Monday).
    const daysUntilMonday = (8 - cursor.getUTCDay()) % 7 || 7
    cursor.setUTCDate(cursor.getUTCDate() + daysUntilMonday)
  } else {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  // `<= to`: the final bucket end covers the last partial interval whose end
  // coincides with the exclusive range boundary.
  while (cursor.getTime() <= to.getTime()) {
    ends.push(new Date(cursor))
    cursor.setTime(cursor.getTime() + stepMs)
  }
  return ends
}

export interface CumulativeTrendInput {
  /** Enrollments created before the range starts (denominator base). */
  baseCreated: number
  /** Enrollments completed before the range starts (numerator base). */
  baseCompleted: number
  /** Enrollment creation instants inside the range. */
  createdAts: Date[]
  /** Enrollment completion instants inside the range. */
  completedAts: Date[]
}

/**
 * Cumulative completion rate (S-5.1 line chart): completed / enrolled as of
 * each bucket end. Buckets with zero enrolled-so-far produce no point, so the
 * chart starts when the course actually has students.
 */
export function buildCompletionTrend(
  from: Date,
  to: Date,
  granularity: TrendGranularity,
  input: CumulativeTrendInput,
): TrendPoint[] {
  const created = [...input.createdAts].sort((a, b) => a.getTime() - b.getTime())
  const completed = [...input.completedAts].sort((a, b) => a.getTime() - b.getTime())

  let createdCursor = 0
  let completedCursor = 0
  const points: TrendPoint[] = []

  for (const end of bucketEndsUTC(from, to, granularity)) {
    while (createdCursor < created.length && created[createdCursor].getTime() < end.getTime()) {
      createdCursor += 1
    }
    while (
      completedCursor < completed.length &&
      completed[completedCursor].getTime() < end.getTime()
    ) {
      completedCursor += 1
    }
    const enrolledSoFar = input.baseCreated + createdCursor
    if (enrolledSoFar === 0) continue
    const completedSoFar = input.baseCompleted + completedCursor
    points.push({
      date: end.toISOString(),
      value: Math.round((completedSoFar / enrolledSoFar) * 10_000) / 100,
    })
  }
  return points
}

/**
 * Mean per-student time spent (hours) — S-5.1 "Avg Time". Denominator is the
 * distinct students who recorded time in the period, not the enrollment count.
 */
export function averageHoursPerStudent(
  timeSpentSeconds: number,
  distinctStudents: number,
): number | null {
  if (distinctStudents <= 0) return null
  return Math.round((timeSpentSeconds / 3600 / distinctStudents) * 100) / 100
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/**
 * Distinct active students per ISO weekday (S-5.1 bar chart). An "activity
 * event" is a lesson completion (completedAt) or a quiz attempt (startedAt)
 * inside the range; duplicates collapse per weekday.
 */
export function buildWeekdayActivity(
  events: Array<{ studentId: string; at: Date }>,
): WeekdayActivityPoint[] {
  const seen = new Map<number, Set<string>>()
  for (const event of events) {
    if (Number.isNaN(event.at.getTime())) continue
    const iso = event.at.getUTCDay() === 0 ? 7 : event.at.getUTCDay()
    let bucket = seen.get(iso)
    if (!bucket) {
      bucket = new Set<string>()
      seen.set(iso, bucket)
    }
    bucket.add(event.studentId)
  }
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    students: seen.get(index + 1)?.size ?? 0,
  }))
}

export function weekdayLabel(isoWeekday: number): string {
  return WEEKDAY_LABELS[isoWeekday - 1] ?? '—'
}

export interface ModuleMathInput {
  moduleId: string
  title: string
  lessonCount: number
  /** Students who completed every lesson of the module. */
  completedStudents: number
  avgScorePct: number | null
  quizzes: Array<{ lessonId: string; title: string }>
}

/**
 * Module breakdown rows (S-5.1): completion % against the enrolled base and
 * a percentage-point drop-off vs the previous module (module 1 vs 100).
 */
export function buildModuleRows(
  modules: ModuleMathInput[],
  enrolledStudents: number,
): ModuleBreakdownRow[] {
  let previousPct: number | null = 100
  return modules.map((module) => {
    const completionPct =
      module.lessonCount > 0 && enrolledStudents > 0
        ? Math.round((module.completedStudents / enrolledStudents) * 10_000) / 100
        : null
    const dropOffPts =
      completionPct != null && previousPct != null
        ? Math.round((previousPct - completionPct) * 100) / 100
        : null
    if (completionPct != null) previousPct = completionPct
    return {
      moduleId: module.moduleId,
      title: module.title,
      completedStudents: module.completedStudents,
      completionPct,
      avgScorePct: module.avgScorePct == null ? null : round2(module.avgScorePct),
      dropOffPts,
      quizzes: module.quizzes,
    }
  })
}

/**
 * Funnel steps (S-5.3): Enrolled → per-module "done" → Completed. Counts are
 * all-time so the funnel matches the S-5.1 module table.
 */
export function buildFunnelSteps(
  enrolled: number,
  moduleSteps: Array<{ label: string; count: number }>,
  completed: number,
): FunnelStep[] {
  const raw: Array<{ label: string; count: number }> = [
    { label: 'Enrolled', count: enrolled },
    ...moduleSteps,
    { label: 'Completed', count: completed },
  ]

  return raw.map((step, index) => {
    const pctOfEnrolled = enrolled > 0 ? round2((step.count / enrolled) * 100) : 0
    const previous = index > 0 ? raw[index - 1] : null
    const previousPct = previous && enrolled > 0 ? round2((previous.count / enrolled) * 100) : 100
    const declinePts = round2(previousPct - pctOfEnrolled)
    return {
      label: step.label,
      count: step.count,
      pctOfEnrolled,
      declinePts: index === 0 ? 0 : declinePts,
      flagged: index > 0 && declinePts > FUNNEL_FLAG_THRESHOLD_PTS,
    }
  })
}

/**
 * The steepest consecutive decline (S-5.3 "Biggest Drop"). Ties resolve to
 * the earliest step for deterministic output.
 */
export function findBiggestDrop(steps: FunnelStep[]): {
  fromLabel: string
  toLabel: string
  declinePts: number
} | null {
  let worst: { fromLabel: string; toLabel: string; declinePts: number } | null = null
  for (let index = 1; index < steps.length; index += 1) {
    const step = steps[index]
    if (worst == null || step.declinePts > worst.declinePts) {
      worst = {
        fromLabel: steps[index - 1].label,
        toLabel: step.label,
        declinePts: step.declinePts,
      }
    }
  }
  return worst
}

/**
 * Likely-cause lesson inside the module after the biggest drop: the lesson
 * with the lowest mean watch ratio among lessons with durations; lessons
 * without durations fall back to completion count, lowest first.
 */
export function selectLikelyCause(lessons: LessonEngagementRow[]): LessonEngagementRow | null {
  const withRatio = lessons.filter((lesson) => lesson.avgWatchPct != null)
  if (withRatio.length > 0) {
    return withRatio.reduce((lowest, lesson) =>
      lesson.avgWatchPct! < lowest.avgWatchPct! ? lesson : lowest,
    )
  }
  if (lessons.length === 0) return null
  return lessons.reduce((lowest, lesson) =>
    lesson.completions < lowest.completions ? lesson : lowest,
  )
}

/** S-5.2 summary line: attempts, mean score, share of passes. */
export function buildQuizSummary(
  attempts: Array<{ scorePct: number; isPassed: boolean }>,
): QuizSummary {
  if (attempts.length === 0) {
    return { attempts: 0, avgScorePct: null, passRatePct: null }
  }
  const avgScorePct =
    Math.round((attempts.reduce((sum, a) => sum + a.scorePct, 0) / attempts.length) * 100) / 100
  const passRatePct =
    Math.round((attempts.filter((a) => a.isPassed).length / attempts.length) * 10_000) / 100
  return { attempts: attempts.length, avgScorePct, passRatePct }
}

export interface AnswerEventInput {
  attemptId: number
  startedAt: Date
  answers: Array<{
    questionId: number
    studentAnswer: string | null
    isCorrect: boolean
    answeredAt: Date
  }>
}

export interface QuestionMetaInput {
  questionId: number
  prompt: string
  optionTexts: string[]
}

/**
 * Per-question stats (S-5.2):
 * - correctPct  = mean isCorrect over recorded answers.
 * - avgTime     = mean seconds between consecutive answers inside an attempt;
 *                 the first answer is measured against attempt.startedAt.
 *                 Negative deltas (clock skew) clamp to 0.
 * - distribution counts normalized option labels; blanks collapse into
 *   "Unanswered"; free-text answers show verbatim.
 */
export function buildQuestionRows(
  attempts: AnswerEventInput[],
  questions: QuestionMetaInput[],
): QuizQuestionRow[] {
  const byQuestion = new Map<
    number,
    { correct: number; answered: number; deltas: number[]; answers: Array<string | null> }
  >()
  for (const question of questions) {
    byQuestion.set(question.questionId, { correct: 0, answered: 0, deltas: [], answers: [] })
  }

  for (const attempt of attempts) {
    const ordered = [...attempt.answers].sort(
      (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime(),
    )
    let previousAt = attempt.startedAt
    for (const answer of ordered) {
      const bucket = byQuestion.get(answer.questionId)
      if (!bucket) continue
      bucket.answered += 1
      if (answer.isCorrect) bucket.correct += 1
      const delta = (answer.answeredAt.getTime() - previousAt.getTime()) / 1000
      bucket.deltas.push(delta > 0 ? delta : 0)
      bucket.answers.push(answer.studentAnswer)
      previousAt = answer.answeredAt
    }
  }

  return questions.map((question) => {
    const bucket = byQuestion.get(question.questionId)!
    const correctPct = bucket.answered > 0 ? round2((bucket.correct / bucket.answered) * 100) : null
    const avgTimeSeconds =
      bucket.deltas.length > 0
        ? round2(bucket.deltas.reduce((sum, d) => sum + d, 0) / bucket.deltas.length)
        : null
    return {
      questionId: String(question.questionId),
      prompt: question.prompt,
      correctPct,
      avgTimeSeconds,
      flagged: correctPct != null && correctPct < QUESTION_FLAG_THRESHOLD_PCT,
      distribution: buildDistribution(bucket.answers, question.optionTexts),
    }
  })
}

const UNANSWERED_LABEL = 'Unanswered'

/**
 * Answer-choice distribution: counts per normalized option label, blanks
 * collapsed into "Unanswered", free-text kept verbatim, sorted by count
 * descending (counts tie → label order).
 */
export function buildDistribution(
  answers: Array<string | null>,
  optionTexts: string[],
): AnswerDistributionRow[] {
  const total = answers.length
  if (total === 0) return []

  const options = optionTexts.map((text) => text.trim()).filter(Boolean)
  // Case-insensitive answer → canonical option label (first option wins on
  // case-only collisions).
  const canonical = new Map<string, string>()
  for (const option of options) {
    const key = option.toLowerCase()
    if (!canonical.has(key)) canonical.set(key, option)
  }

  const counts = new Map<string, number>()
  for (const answer of answers) {
    let key: string
    if (answer == null || answer.trim() === '') {
      key = UNANSWERED_LABEL
    } else {
      const trimmed = answer.trim()
      key = canonical.get(trimmed.toLowerCase()) ?? trimmed
    }
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows: AnswerDistributionRow[] = []
  // Every option gets a row (zero counts included — the full choice set).
  for (const option of options) {
    const count = counts.get(option) ?? 0
    counts.delete(option)
    rows.push({ label: option, count, pct: round2((count / total) * 100) })
  }
  // Remaining buckets: free-text answers and the Unanswered group.
  for (const [label, count] of counts) {
    rows.push({ label, count, pct: round2((count / total) * 100) })
  }

  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return rows
}

export interface CohortMetricDefinition {
  metric: CohortComparisonMetricRow['metric']
  label: string
  betterDirection: 'higher' | 'lower'
  pick: (column: CohortComparisonColumn) => number | null
}

const COHORT_METRICS: CohortMetricDefinition[] = [
  {
    metric: 'completion',
    label: 'Avg. Completion',
    betterDirection: 'higher',
    pick: (column) => column.avgCompletionPct,
  },
  {
    metric: 'quizScore',
    label: 'Avg. Quiz Score',
    betterDirection: 'higher',
    pick: (column) => column.avgQuizScorePct,
  },
  {
    metric: 'timeToFinish',
    label: 'Avg. Time-to-Finish',
    betterDirection: 'lower',
    pick: (column) => column.avgWeeksToFinish,
  },
]

/**
 * S-5.5 comparison rows. Arrows compare each column with the previous one:
 * true = the later column improved (respecting each metric's better
 * direction), null when either side lacks data.
 */
export function buildCohortComparisonRows(
  columns: CohortComparisonColumn[],
): CohortComparisonMetricRow[] {
  return COHORT_METRICS.map((definition) => {
    const values = columns.map((column) => definition.pick(column))
    const arrows = values.map((value, index) => {
      if (index === 0 || value == null) return null
      const previous = values[index - 1]
      if (previous == null) return null
      return definition.betterDirection === 'higher' ? value > previous : value < previous
    })
    return {
      metric: definition.metric,
      label: definition.label,
      betterDirection: definition.betterDirection,
      values,
      arrows,
    }
  })
}

/** KPI helper: assemble an S-5.1 card with the shared availability semantics. */
export function kpi(
  id: AnalyticsKpi['id'],
  label: string,
  format: AnalyticsKpi['format'],
  value: number | null,
  deltaPct: number | null,
  availability: AnalyticsKpi['availability'],
  note?: string,
): AnalyticsKpi {
  const withNote: AnalyticsKpi = {
    id,
    label,
    format,
    value: availability === 'ok' ? value : null,
    deltaPct: availability === 'ok' ? deltaPct : null,
    availability,
  }
  if (note != null) withNote.note = note
  return withNote
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Re-exported so impl modules share one label formatter. */
export { formatTrendBucket }
