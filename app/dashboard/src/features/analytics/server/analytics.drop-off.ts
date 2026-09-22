import { createServerFn } from '@tanstack/react-start'
import { analyticsRangeSchema } from '../schemas/analytics.schema'
import type { DropOffAnalytics } from '../analytics.types'

/** S-5.3 Drop-off Analysis for one course. */
export const getDropOffAnalytics = createServerFn({ method: 'GET' })
  .validator(async (input: unknown) => {
    const { z } = await import('zod')
    const schema = z.object({ courseId: z.string().uuid() }).and(analyticsRangeSchema)
    return schema.parse(input)
  })
  .handler(async ({ data }): Promise<DropOffAnalytics> => {
    const { loadDropOffAnalytics } = await import('./analytics.drop-off.impl.server')
    return loadDropOffAnalytics(data.courseId, data)
  })
