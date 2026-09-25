import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { coursePricingSchema } from '../schemas/courses.authoring.schema'
import type { CoursePricingDTO } from '../courses.types'

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })

export const getCoursePricing = createServerFn({ method: 'GET' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<CoursePricingDTO> => {
    const { getCoursePricingImpl } = await import('./courses.pricing.impl.server')
    return getCoursePricingImpl(data.coursePublicId)
  })

export const saveCoursePricing = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    coursePricingSchema.extend({ coursePublicId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { saveCoursePricingImpl } = await import('./courses.pricing.impl.server')
    return saveCoursePricingImpl(data)
  })
