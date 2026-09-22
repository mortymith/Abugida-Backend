import { queryOptions } from '@tanstack/react-query'
import {
  getAffiliateProgram,
  getComposerReference,
  getCouponRedemptions,
  getCampaign,
  getCampaigns,
  getPendingPayouts,
  getPayoutHistory,
  getTemplate,
  getTestimonialCourseOptions,
  getTestimonialSettings,
  listAffiliates,
  listCoupons,
  listTemplates,
  listTestimonialRequests,
  listTestimonials,
} from '../server/all'
import type { TestimonialQueryInput } from '../schemas/marketing.schema'

export const marketingQueryKeys = {
  campaigns: (status: string) => ['marketing', 'campaigns', status] as const,
  campaign: (publicId: string) => ['marketing', 'campaign', publicId] as const,
  composerReference: () => ['marketing', 'composer-reference'] as const,
  templates: () => ['marketing', 'templates'] as const,
  template: (publicId: string) => ['marketing', 'template', publicId] as const,
  coupons: (status: string) => ['marketing', 'coupons', status] as const,
  couponRedemptions: (publicId: string) => ['marketing', 'coupon-redemptions', publicId] as const,
  affiliateProgram: () => ['marketing', 'affiliate-program'] as const,
  affiliates: (status: string) => ['marketing', 'affiliates', status] as const,
  pendingPayouts: () => ['marketing', 'pending-payouts'] as const,
  payoutHistory: () => ['marketing', 'payout-history'] as const,
  testimonials: (query: TestimonialQueryInput) => ['marketing', 'testimonials', query] as const,
  testimonialRequests: () => ['marketing', 'testimonial-requests'] as const,
  testimonialSettings: () => ['marketing', 'testimonial-settings'] as const,
  testimonialCourses: () => ['marketing', 'testimonial-courses'] as const,
}

const STALE = {
  lists: 30_000,
  details: 15_000,
  reference: 300_000,
  settings: 60_000,
} as const

export function campaignsQueryOptions(status: string) {
  return queryOptions({
    queryKey: marketingQueryKeys.campaigns(status),
    queryFn: () => getCampaigns({ data: { status } }),
    staleTime: STALE.lists,
  })
}

export function campaignDetailQueryOptions(publicId: string) {
  return queryOptions({
    queryKey: marketingQueryKeys.campaign(publicId),
    queryFn: () => getCampaign({ data: { campaignPublicId: publicId } }),
    staleTime: STALE.details,
  })
}

export function composerReferenceQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.composerReference(),
    queryFn: () => getComposerReference(),
    staleTime: STALE.reference,
  })
}

export function templatesQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.templates(),
    queryFn: () => listTemplates(),
    staleTime: STALE.lists,
  })
}

export function templateDetailQueryOptions(publicId: string) {
  return queryOptions({
    queryKey: marketingQueryKeys.template(publicId),
    queryFn: () => getTemplate({ data: { templatePublicId: publicId } }),
    staleTime: STALE.lists,
  })
}

export function couponsQueryOptions(status: string) {
  return queryOptions({
    queryKey: marketingQueryKeys.coupons(status),
    queryFn: () => listCoupons({ data: { status } }),
    staleTime: STALE.lists,
  })
}

export function couponRedemptionsQueryOptions(publicId: string) {
  return queryOptions({
    queryKey: marketingQueryKeys.couponRedemptions(publicId),
    queryFn: () => getCouponRedemptions({ data: { couponPublicId: publicId } }),
    staleTime: STALE.lists,
  })
}

export function affiliateProgramQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.affiliateProgram(),
    queryFn: () => getAffiliateProgram(),
    staleTime: STALE.lists,
  })
}

export function affiliatesQueryOptions(status: string) {
  return queryOptions({
    queryKey: marketingQueryKeys.affiliates(status),
    queryFn: () => listAffiliates({ data: { status } }),
    staleTime: STALE.lists,
  })
}

export function pendingPayoutsQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.pendingPayouts(),
    queryFn: () => getPendingPayouts(),
    staleTime: STALE.details,
  })
}

export function payoutHistoryQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.payoutHistory(),
    queryFn: () => getPayoutHistory(),
    staleTime: STALE.lists,
  })
}

export function testimonialsQueryOptions(query: TestimonialQueryInput) {
  return queryOptions({
    queryKey: marketingQueryKeys.testimonials(query),
    queryFn: () => listTestimonials({ data: query }),
    staleTime: STALE.lists,
  })
}

export function testimonialRequestsQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.testimonialRequests(),
    queryFn: () => listTestimonialRequests(),
    staleTime: STALE.lists,
  })
}

export function testimonialSettingsQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.testimonialSettings(),
    queryFn: () => getTestimonialSettings(),
    staleTime: STALE.settings,
  })
}

export function testimonialCourseOptionsQueryOptions() {
  return queryOptions({
    queryKey: marketingQueryKeys.testimonialCourses(),
    queryFn: () => getTestimonialCourseOptions(),
    staleTime: STALE.reference,
  })
}
