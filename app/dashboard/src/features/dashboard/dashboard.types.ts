import type { TrendGranularity } from './schemas/dashboard.date-range.schema'

/** Why a metric is not (fully) rendered. Drives honest UI per plan §9-R2. */
export type MetricAvailability =
  | 'ok' // value present
  | 'no_data' // metric supported, but nothing recorded in range
  | 'unsupported' // metric has no data source in the platform yet (A3)

export interface KpiMetric {
  id:
    | 'revenue'
    | 'courses'
    | 'students'
    | 'avgRating'
    | 'total'
    | 'oneTime'
    | 'subscription'
    | 'refund'
  label: string
  format: 'currency' | 'integer' | 'rating'
  value: number | null
  /** % change vs the previous equal-length period. */
  deltaPct: number | null
  availability: MetricAvailability
  /** Optional explanatory note, surfaced as a tooltip (spec 11: explain, don't no-op). */
  note?: string
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
}

export interface DashboardOverview {
  range: { from: string; to: string; label: string }
  /** True when every surface is empty for the period → screen-level empty state. */
  isEmpty: boolean
  kpis: KpiMetric[]
  revenueTrend: TrendSeries
  enrollmentTrend: TrendSeries
}

export interface CoursePerformanceRow {
  courseId: string
  title: string
  slug: string
  students: number
  /** Average enrollment progress 0–100. */
  completionPct: number | null
  /** Revenue within the selected range; hidden for roles without revenue access. */
  revenue: number | null
}

export interface CoursePerformancePage {
  rows: CoursePerformanceRow[]
  page: number
  pageSize: number
  totalRows: number
  hasNextPage: boolean
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

export interface RevenueAnalytics {
  range: { from: string; to: string; label: string }
  isEmpty: boolean
  summary: KpiMetric[]
  byCourse: RevenueByCourseRow[]
  byGateway: RevenueByGatewayRow[]
  /** One-time vs subscription split; subscription is `unsupported` today (A3). */
  split: {
    oneTimePct: number | null
    subscriptionPct: number | null
    availability: MetricAvailability
    note?: string
  }
}
