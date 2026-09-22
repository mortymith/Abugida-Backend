import { createServerFn } from '@tanstack/react-start'
import { exportReportSchema } from '../schemas/analytics.schema'
import type { ExportCourseOption, GeneratedReport } from '../analytics.types'

/**
 * S-5.4 Export Reports. Admin/Editor only (server-enforced in the impl);
 * revenue figures are further restricted to REVENUE_ROLES. Returns base64
 * file bytes the client turns into a download.
 */
export const generateAnalyticsReport = createServerFn({ method: 'POST' })
  .validator((input: unknown) => exportReportSchema.parse(input))
  .handler(async ({ data }): Promise<GeneratedReport> => {
    const { generateAnalyticsReport: generate } = await import('./analytics.export.impl.server')
    return generate(data)
  })

/** Course options for the export modal's multi-select. */
export const listExportCourses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ExportCourseOption[]> => {
    const { listExportCourses: list } = await import('./analytics.export.impl.server')
    return list()
  },
)
