/**
 * Marketing & Growth feature (spec 10) — public exports. Routes and other
 * features import only from here, never from internal files.
 */

// Views
export { MarketingSectionNav } from './components/marketing.section-nav'
export { MarketingStatusBadge } from './components/marketing.status-badge'
export { CampaignsView } from './components/marketing.campaigns-view'
export { CampaignComposeDialog } from './components/marketing.campaign-compose-dialog'
export { TemplatesView } from './components/marketing.templates-view'
export { TemplateEditorView } from './components/marketing.template-editor'
export { CouponsView } from './components/marketing.coupons-view'
export { AffiliatesView } from './components/marketing.affiliates-view'
export { TestimonialsView } from './components/marketing.testimonials-view'

// Hooks
export {
  campaignsQueryOptions,
  campaignDetailQueryOptions,
  composerReferenceQueryOptions,
  couponsQueryOptions,
  affiliateProgramQueryOptions,
  affiliatesQueryOptions,
  couponRedemptionsQueryOptions,
  marketingQueryKeys,
  payoutHistoryQueryOptions,
  pendingPayoutsQueryOptions,
  templateDetailQueryOptions,
  templatesQueryOptions,
  testimonialCourseOptionsQueryOptions,
  testimonialRequestsQueryOptions,
  testimonialSettingsQueryOptions,
  testimonialsQueryOptions,
} from './hooks/marketing.queries'

export * from './hooks/marketing.mutations'

// Schemas
export type {
  CampaignCreateInput,
  CampaignScheduleInput,
  CampaignUpdateInput,
  CouponBatchInput,
  CouponCreateInput,
  ProgramSettingsInput,
  TemplateSaveInput,
  TestimonialDecisionInput,
  TestimonialSettingsInput,
} from './schemas/marketing.schema'

// Pure logic shared with other modules
export { MERGE_TAGS, renderMergeTags, validateMergeTags } from './marketing.merge-tags'
export {
  buildCouponCsv,
  generateCouponCodes,
  MAX_BATCH_SIZE,
  normalizeCouponCode,
} from './marketing.coupon-codes'
export {
  describeAudience,
  isEditable,
  isMetricsUpdating,
  requiresLargeSendConfirmation,
  LARGE_SEND_THRESHOLD,
} from './marketing.campaign-states'
export { computeCommissionAmount } from './marketing.commission-math'
export { isHeavyEdit, isQuoteLengthValid } from './marketing.testimonial-rules'
export { renderTemplateDocument } from './marketing.email-render'
