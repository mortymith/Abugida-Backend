import { createServerFn } from '@tanstack/react-start'
import { dateRangeInputSchema } from '../schemas/dashboard.date-range.schema'
import type { DashboardOverview } from '../dashboard.types'

/**
 * Server function for S-1.1 Analytics Overview. Implementation lives in the
 * server-only impl module, dynamically imported inside the handler so this
 * file stays safe for the client bundle (TanStack Start strips handler
 * bodies from client output).
 */
export const getDashboardOverview = createServerFn({ method: 'GET' })
  .validator((input: unknown) => dateRangeInputSchema.parse(input))
  .handler(async ({ data }): Promise<DashboardOverview> => {
    const { loadDashboardOverview } = await import('./dashboard.overview.impl.server')
    return loadDashboardOverview(data)
  })
