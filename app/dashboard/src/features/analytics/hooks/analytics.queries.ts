import { queryOptions } from '@tanstack/react-query'
import { getCohortComparison } from '../server/analytics.cohorts'
import { getCoursePerformanceAnalytics } from '../server/analytics.performance'
import { getDropOffAnalytics } from '../server/analytics.drop-off'
import { getQuizAnalytics } from '../server/analytics.quiz'
import { listExportCourses } from '../server/analytics.export'
import type { AnalyticsRangeInput } from '../schemas/analytics.schema'

export const analyticsQueryKeys = {
  performance: (courseId: string, range: AnalyticsRangeInput) =>
    ['analytics', 'performance', courseId, range] as const,
  dropOff: (courseId: string, range: AnalyticsRangeInput) =>
    ['analytics', 'drop-off', courseId, range] as const,
  quiz: (courseId: string, lessonId: string, range: AnalyticsRangeInput) =>
    ['analytics', 'quiz', courseId, lessonId, range] as const,
  cohorts: (cohortIds: string[]) => ['analytics', 'cohorts', cohortIds] as const,
  exportCourses: () => ['analytics', 'export-courses'] as const,
}

const STALE = {
  performance: 60_000,
  dropOff: 60_000,
  quiz: 60_000,
  cohorts: 120_000,
  exportCourses: 300_000,
}

export function performanceAnalyticsQueryOptions(courseId: string, range: AnalyticsRangeInput) {
  return queryOptions({
    queryKey: analyticsQueryKeys.performance(courseId, range),
    queryFn: () => getCoursePerformanceAnalytics({ data: { courseId, ...range } }),
    staleTime: STALE.performance,
  })
}

export function dropOffAnalyticsQueryOptions(courseId: string, range: AnalyticsRangeInput) {
  return queryOptions({
    queryKey: analyticsQueryKeys.dropOff(courseId, range),
    queryFn: () => getDropOffAnalytics({ data: { courseId, ...range } }),
    staleTime: STALE.dropOff,
  })
}

export function quizAnalyticsQueryOptions(
  courseId: string,
  lessonId: string,
  range: AnalyticsRangeInput,
) {
  return queryOptions({
    queryKey: analyticsQueryKeys.quiz(courseId, lessonId, range),
    queryFn: () => getQuizAnalytics({ data: { courseId, lessonId, ...range } }),
    staleTime: STALE.quiz,
  })
}

export function cohortComparisonQueryOptions(cohortIds: string[]) {
  return queryOptions({
    queryKey: analyticsQueryKeys.cohorts(cohortIds),
    queryFn: () => getCohortComparison({ data: { cohorts: cohortIds.join(',') || undefined } }),
    staleTime: STALE.cohorts,
  })
}

export function exportCoursesQueryOptions() {
  return queryOptions({
    queryKey: analyticsQueryKeys.exportCourses(),
    queryFn: () => listExportCourses(),
    staleTime: STALE.exportCourses,
  })
}
