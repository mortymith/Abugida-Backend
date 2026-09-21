import { queryOptions } from '@tanstack/react-query'
import { getDashboardOverview } from './server/dashboard.overview.server'
import { getRevenueAnalytics } from './server/dashboard.revenue.server'
import { getCoursePerformance } from './server/dashboard.course-performance.server'
import type { DateRangeInput } from './schemas/dashboard.date-range.schema'

export const dashboardQueryKeys = {
  overview: (range: DateRangeInput) => ['dashboard', 'overview', range] as const,
  revenue: (range: DateRangeInput) => ['dashboard', 'revenue', range] as const,
  coursePerformance: (range: DateRangeInput, page: number) =>
    ['dashboard', 'course-performance', range, page] as const,
}

const STALE = { overview: 60_000, revenue: 60_000, coursePerformance: 30_000 }

export function overviewQueryOptions(range: DateRangeInput) {
  return queryOptions({
    queryKey: dashboardQueryKeys.overview(range),
    queryFn: () => getDashboardOverview({ data: range }),
    staleTime: STALE.overview,
  })
}

export function revenueQueryOptions(range: DateRangeInput) {
  return queryOptions({
    queryKey: dashboardQueryKeys.revenue(range),
    queryFn: () => getRevenueAnalytics({ data: range }),
    staleTime: STALE.revenue,
  })
}

export function coursePerformanceQueryOptions(range: DateRangeInput, page: number) {
  return queryOptions({
    queryKey: dashboardQueryKeys.coursePerformance(range, page),
    queryFn: () => getCoursePerformance({ data: { ...range, page } }),
    staleTime: STALE.coursePerformance,
  })
}
