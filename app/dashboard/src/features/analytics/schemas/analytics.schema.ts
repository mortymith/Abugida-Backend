import { z } from 'zod'
import { DATE_RANGE_PRESETS } from '#/features/dashboard/schemas/dashboard.date-range.schema'
import type { ReportFormat, ReportType } from '../analytics.types'

/**
 * Shared analytics search-param / server-fn range input. Mirrors the
 * dashboard feature's schema so URLs stay consistent across S-1.x and S-5.x.
 */
export const analyticsRangeSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})
export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>

/** S-5.2 route params: course + quiz lesson, both public UUIDs. */
export const quizAnalyticsParamsSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
})

/** S-5.5 cohorts to compare — 2–4 public UUIDs, deduplicated by the impl. */
export const cohortComparisonSearchSchema = z.object({
  cohorts: z.string().optional(),
})

const REPORT_TYPES: ReportType[] = [
  'course-performance',
  'student-progress',
  'quiz',
  'revenue',
  'cohort-comparison',
]
const REPORT_FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf']

/** S-5.4 Export Reports configuration. */
export const exportReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES as [ReportType, ...ReportType[]]),
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  /** Selected course public IDs (multi-select); empty = all accessible. */
  courseIds: z.array(z.string().uuid()).max(50).default([]),
  format: z.enum(REPORT_FORMATS as [ReportFormat, ...ReportFormat[]]),
  includeAggregatedCharts: z.boolean().default(false),
  includeStudentLevelData: z.boolean().default(false),
  /** Quiz lesson scope for the `quiz` report type. */
  lessonId: z.string().uuid().optional(),
  /** Cohort public IDs for the `cohort-comparison` report type. */
  cohortIds: z.array(z.string().uuid()).max(4).optional(),
})
export type ExportReportInput = z.infer<typeof exportReportSchema>
