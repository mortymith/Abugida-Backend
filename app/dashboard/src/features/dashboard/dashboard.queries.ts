import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { getDashboardOverview } from './server/dashboard.overview'
import { getRevenueAnalytics } from './server/dashboard.revenue'
import { getCoursePerformance } from './server/dashboard.course-performance'
import type { CoursePerformanceSort } from './dashboard.types'
import type { DateRangeInput } from './schemas/dashboard.date-range.schema'

export const dashboardQueryKeys = {
  overview: (range: DateRangeInput) => ['dashboard', 'overview', range] as const,
  revenue: (range: DateRangeInput) => ['dashboard', 'revenue', range] as const,
  coursePerformance: (range: DateRangeInput, page: number, sort: CoursePerformanceSort) =>
    ['dashboard', 'course-performance', range, page, sort] as const,
}

const STALE = { overview: 60_000, revenue: 60_000, coursePerformance: 30_000 }

export function overviewQueryOptions(range: DateRangeInput) {
  return queryOptions({
    queryKey: dashboardQueryKeys.overview(range),
    queryFn: () => getDashboardOverview({ data: range }),
    staleTime: STALE.overview,
    // A range change repaints over the previous values instead of flashing `—`.
    placeholderData: keepPreviousData,
  })
}

export function revenueQueryOptions(range: DateRangeInput) {
  return queryOptions({
    queryKey: dashboardQueryKeys.revenue(range),
    queryFn: () => getRevenueAnalytics({ data: range }),
    staleTime: STALE.revenue,
    placeholderData: keepPreviousData,
  })
}

export function coursePerformanceQueryOptions(
  range: DateRangeInput,
  page: number,
  sort: CoursePerformanceSort = 'revenue',
) {
  return queryOptions({
    queryKey: dashboardQueryKeys.coursePerformance(range, page, sort),
    queryFn: () => getCoursePerformance({ data: { ...range, page, sort } }),
    staleTime: STALE.coursePerformance,
    placeholderData: keepPreviousData,
  })
}
