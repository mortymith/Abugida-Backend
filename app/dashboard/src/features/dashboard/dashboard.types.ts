import type { TrendGranularity } from './schemas/dashboard.date-range.schema'

/** Why a metric is not (fully) rendered. Drives honest UI per spec 11 §4.5. */
export type MetricAvailability =
  | 'ok' // value present
  | 'no_data' // metric supported, but nothing recorded in range
  | 'unsupported' // metric has no data source in the platform yet
  | 'error' // this card's own query failed — the rest of the screen is fine

export interface KpiMetric {
  id:
    | 'revenue'
    | 'courses'
    | 'students'
    | 'avgRating'
    | 'completion'
    | 'avgTime'
    | 'total'
    | 'oneTime'
    | 'subscription'
    | 'refund'
  label: string
  format: 'currency' | 'integer' | 'rating' | 'percent' | 'hours'
  value: number | null
  /**
   * % change vs the comparison period, or `null` — which the card renders as
   * `—`. `null` means "no history to compare", never "measured, unchanged"
   * (spec S-1.1 stat card contract).
   */
  deltaPct: number | null
  availability: MetricAvailability
  /** Optional explanatory note, surfaced as a tooltip (spec 11: explain, don't no-op). */
  note?: string
  /**
   * The role is not granted `finance.view_revenue`: the figure is absent from
   * the payload and the card explains why instead of rendering a dash.
   */
  restricted?: boolean
  /** Contributing records in the comparison period (drives the `—` rule). */
  comparisonSample?: number
}

export interface TrendPoint {
  /** Bucket start, ISO instant. */
  date: string
  value: number
}

export interface TrendSeries {
  availability: MetricAvailability
  granularity: TrendGranularity
  points: TrendPoint[]
  note?: string
  /** Comparison-period series, present only when comparison is switched on. */
  comparisonPoints?: TrendPoint[]
}

export interface DashboardRangeInfo {
  from: string
  to: string
  label: string
  /** Named comparison basis, e.g. "previous 30 days". */
  comparisonLabel: string
  /** True when the last day of the range is still in progress. */
  partialDayNote?: string
}

export interface DashboardOverview {
  range: DashboardRangeInfo
  /** True when every surface is empty for the period → screen-level empty state. */
  isEmpty: boolean
  /**
   * False when the workspace has no history at all — the true-empty state
   * ("No history yet"), which is not the same as "no data in this range".
   */
  hasHistory: boolean
  kpis: KpiMetric[]
  revenueTrend: TrendSeries
  enrollmentTrend: TrendSeries
}

export type CourseLifecycle = 'draft' | 'in_review' | 'published' | 'archived'

export interface CoursePerformanceRow {
  courseId: string
  title: string
  slug: string
  /** Lifecycle pill (spec S-1.1 Revision 2) — draft and published are distinct. */
  state: CourseLifecycle
  /**
   * What the lifecycle owes the user: pending review decisions, or curriculum
   * items still missing content. Absent when there is nothing to do.
   */
  stateNote?: string
  students: number
  /** Average enrollment progress 0–100. */
  completionPct: number | null
  /** Revenue within the selected range; hidden for roles without revenue access. */
  revenue: number | null
}

export type CoursePerformanceSort = 'revenue' | 'students' | 'completion'

export interface CoursePerformancePage {
  rows: CoursePerformanceRow[]
  page: number
  pageSize: number
  totalRows: number
  hasNextPage: boolean
  sort: CoursePerformanceSort
  /** False when the caller may not see money, so the column is dropped entirely. */
  canViewRevenue: boolean
}

export interface RevenueByCourseRow {
  courseId: string
  title: string
  amount: number
}

export interface RevenueByGatewayRow {
  gatewayId: string
  displayName: string
  providerName: string
  transactions: number
  amount: number
}

export interface RevenueSlice {
  /** Stable id; `'other'` for the folded tail. */
  id: string
  label: string
  amount: number
  transactions: number
}

export interface RevenueAnalytics {
  range: DashboardRangeInfo
  isEmpty: boolean
  /** False when the workspace has never taken a payment (true-empty state). */
  hasHistory: boolean
  summary: KpiMetric[]
  byCourse: RevenueByCourseRow[]
  byGateway: RevenueByGatewayRow[]
  /** Pie slices, already folded to at most 4 + "Other". */
  slices: RevenueSlice[]
}
