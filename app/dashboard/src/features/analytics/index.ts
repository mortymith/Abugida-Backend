/**
 * Public API of the Analytics feature (spec 07). Routes import through this
 * barrel only; server functions are exported through `./server/all`.
 */
export { AnalyticsHubView } from './components/analytics.hub-view'
export { AnalyticsPerformanceView } from './components/analytics.performance-view'
export { AnalyticsDropOffView } from './components/analytics.drop-off-view'
export { AnalyticsQuizView } from './components/analytics.quiz-view'
export { AnalyticsCohortsView } from './components/analytics.cohorts-view'
export { analyticsQueryKeys } from './hooks/analytics.queries'
export {
  performanceAnalyticsQueryOptions,
  dropOffAnalyticsQueryOptions,
  quizAnalyticsQueryOptions,
  cohortComparisonQueryOptions,
  exportCoursesQueryOptions,
} from './hooks/analytics.queries'
export { FUNNEL_FLAG_THRESHOLD_PTS, QUESTION_FLAG_THRESHOLD_PCT } from './analytics.metric-math'
export type { AnalyticsRangeInput } from './schemas/analytics.schema'
export type { ExportReportInput } from './schemas/analytics.schema'
