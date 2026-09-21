import { createServerFn } from '@tanstack/react-start'
import { dateRangeInputSchema } from '../schemas/dashboard.date-range.schema'
import type { RevenueAnalytics } from '../dashboard.types'

/**
 * Server function for S-1.2 Revenue Analytics (admin/editor only).
 * Implementation lives in the server-only impl module, dynamically imported
 * inside the handler so this file stays safe for the client bundle.
 */
export const getRevenueAnalytics = createServerFn({ method: 'GET' })
  .validator((input: unknown) => dateRangeInputSchema.parse(input))
  .handler(async ({ data }): Promise<RevenueAnalytics> => {
    const { loadRevenueAnalytics } = await import('./dashboard.revenue.impl.server')
    return loadRevenueAnalytics(data)
  })
