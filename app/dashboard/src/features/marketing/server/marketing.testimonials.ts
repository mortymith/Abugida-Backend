import { createServerFn } from '@tanstack/react-start'
import {
  testimonialCollectSchema,
  testimonialDecisionSchema,
  testimonialFeatureSchema,
  testimonialQuerySchema,
  testimonialSettingsSchema,
} from '../schemas/marketing.schema'

/** Client-safe S-8.5 Student Testimonials server functions. */

export const listTestimonials = createServerFn({ method: 'GET' })
  .validator((input: unknown) => testimonialQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { listTestimonialsImpl } = await import('./marketing.testimonials.impl.server')
    return listTestimonialsImpl(data)
  })

export const listTestimonialRequests = createServerFn({ method: 'GET' }).handler(async () => {
  const { listTestimonialRequestsImpl } = await import('./marketing.testimonials.impl.server')
  return listTestimonialRequestsImpl()
})

export const getTestimonialSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const { getTestimonialSettingsImpl } = await import('./marketing.testimonials.impl.server')
  return getTestimonialSettingsImpl()
})

export const saveTestimonialSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) => testimonialSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveTestimonialSettingsImpl } = await import('./marketing.testimonials.impl.server')
    return saveTestimonialSettingsImpl(data)
  })

export const collectTestimonialManually = createServerFn({ method: 'POST' })
  .validator((input: unknown) => testimonialCollectSchema.parse(input))
  .handler(async ({ data }) => {
    const { collectTestimonialManuallyImpl } = await import('./marketing.testimonials.impl.server')
    return collectTestimonialManuallyImpl(data)
  })

export const decideTestimonial = createServerFn({ method: 'POST' })
  .validator((input: unknown) => testimonialDecisionSchema.parse(input))
  .handler(async ({ data }) => {
    const { decideTestimonialImpl } = await import('./marketing.testimonials.impl.server')
    return decideTestimonialImpl(data)
  })

export const setTestimonialFeatured = createServerFn({ method: 'POST' })
  .validator((input: unknown) => testimonialFeatureSchema.parse(input))
  .handler(async ({ data }) => {
    const { setTestimonialFeaturedImpl } = await import('./marketing.testimonials.impl.server')
    return setTestimonialFeaturedImpl(data)
  })

export const getTestimonialCourseOptions = createServerFn({ method: 'GET' }).handler(async () => {
  const { getTestimonialCourseOptionsImpl } = await import('./marketing.testimonials.impl.server')
  return getTestimonialCourseOptionsImpl()
})
