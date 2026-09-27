/**
 * Barrel for the Analytics feature's server functions. Import from here (or
 * the individual wrapper modules) in routes and hooks — never from impl
 * modules, which are server-only.
 */
export { getCoursePerformanceAnalytics } from './analytics.performance'
export { getDropOffAnalytics } from './analytics.drop-off'
export { getQuizAnalytics } from './analytics.quiz'
export { getCohortComparison } from './analytics.cohorts'
export { generateAnalyticsReport, listExportCourses } from './analytics.export'
