import { z } from 'zod'

/**
 * Input validation for Marketing & Growth server functions (spec 10).
 * Shared between the client-safe wrapper modules (types) and the impl
 * modules (parsing), mirroring the courses/students/settings conventions.
 */

const uuidSchema = z.string().uuid()

// ── Shared ───────────────────────────────────────────────────────────────────

export const marketingQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().optional(),
})
export type MarketingQueryInput = z.infer<typeof marketingQuerySchema>

// ── S-8.1 Campaigns ──────────────────────────────────────────────────────────

export const campaignAudienceInputSchema = z
  .object({
    cohortPublicIds: z.array(uuidSchema).max(50).default([]),
    coursePublicIds: z.array(uuidSchema).max(100).default([]),
    tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    activity: z.enum(['any', 'active_30d', 'inactive_30d', 'completed']).default('any'),
  })
  .strict()
export type CampaignAudienceInput = z.infer<typeof campaignAudienceInputSchema>

export const campaignsQuerySchema = z.object({
  status: z.enum(['all', 'draft', 'scheduled', 'sending', 'sent', 'cancelled']).default('all'),
})
export type CampaignsQueryInput = z.infer<typeof campaignsQuerySchema>

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(200),
  subject: z.string().trim().min(1, 'Subject is required').max(150),
  preheader: z.string().trim().max(300).optional(),
  templatePublicId: uuidSchema.nullable().optional(),
  audience: campaignAudienceInputSchema,
})
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>

export const campaignUpdateSchema = campaignCreateSchema.extend({
  campaignPublicId: uuidSchema,
})
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>

export const campaignPublicIdSchema = z.object({ campaignPublicId: uuidSchema })
export type CampaignPublicIdInput = z.infer<typeof campaignPublicIdSchema>

export const campaignScheduleSchema = z.object({
  campaignPublicId: uuidSchema,
  /** ISO datetime; must be in the future (validated server-side too). */
  scheduledFor: z.string().datetime({ offset: true }),
})
export type CampaignScheduleInput = z.infer<typeof campaignScheduleSchema>

export const campaignSendTestSchema = z.object({
  campaignPublicId: uuidSchema.optional(),
  templatePublicId: uuidSchema.optional(),
})
export type CampaignSendTestInput = z.infer<typeof campaignSendTestSchema>

export const audiencePreviewSchema = z.object({
  audience: campaignAudienceInputSchema,
})
export type AudiencePreviewInput = z.infer<typeof audiencePreviewSchema>

// ── S-8.2 Templates ──────────────────────────────────────────────────────────

export const templateBlockInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hero'),
    heading: z.string().trim().min(1).max(200),
    subheading: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal('text'),
    body: z.string().trim().min(1).max(5_000),
  }),
  z.object({
    type: z.literal('button'),
    label: z.string().trim().min(1).max(80),
    url: z.string().trim().min(1).max(2_000),
  }),
  z.object({
    type: z.literal('course_card'),
    coursePublicId: uuidSchema.nullable().optional(),
  }),
])
export type TemplateBlockInput = z.infer<typeof templateBlockInputSchema>

export const templateDocumentInputSchema = z.object({
  blocks: z.array(templateBlockInputSchema).max(25),
})
export type TemplateDocumentInput = z.infer<typeof templateDocumentInputSchema>

export const templateSaveSchema = z.object({
  templatePublicId: uuidSchema.optional(),
  name: z.string().trim().min(1, 'Template name is required').max(200),
  kind: z
    .enum([
      'welcome',
      'announcement',
      'reminder',
      'promotion',
      'certificate_issued',
      're_engagement',
      'custom',
    ])
    .default('custom'),
  subject: z.string().trim().min(1, 'Subject is required').max(150),
  preheader: z.string().trim().max(300).optional(),
  document: templateDocumentInputSchema,
  /** Autosave drafts only; publishing a version is a separate call. */
  publish: z.boolean().default(false),
})
export type TemplateSaveInput = z.infer<typeof templateSaveSchema>

export const templatePublicIdSchema = z.object({ templatePublicId: uuidSchema })
export type TemplatePublicIdInput = z.infer<typeof templatePublicIdSchema>

export const templateTestSampleSchema = z.object({
  /** Chosen test student renders realistic sample data (no PII leaves). */
  studentId: z.string().min(1).optional(),
})
export type TemplateTestSampleInput = z.infer<typeof templateTestSampleSchema>

// ── S-8.3 Coupons ────────────────────────────────────────────────────────────

export const couponCreateSchema = z
  .object({
    /** Explicit code; when omitted a batch of one is generated. */
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens or underscores only')
      .optional(),
    kind: z.enum(['percentage', 'fixed', 'full_access']),
    value: z.number().min(0).optional(),
    scopeCoursePublicIds: z.array(uuidSchema).max(100).default([]),
    /** Null/undefined = unlimited multi-use. */
    maxRedemptions: z.number().int().min(1).max(1_000_000).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    stackable: z.boolean().default(false),
  })
  .refine((data) => data.kind === 'full_access' || (data.value != null && data.value > 0), {
    message: 'Discount value is required',
    path: ['value'],
  })
  .refine(
    (data) =>
      data.kind !== 'percentage' || (data.value != null && data.value >= 1 && data.value <= 99),
    {
      message: 'Percentage must be between 1 and 99',
      path: ['value'],
    },
  )
export type CouponCreateInput = z.infer<typeof couponCreateSchema>

export const couponBatchSchema = couponCreateSchema
  .omit({ code: true, maxRedemptions: true })
  .extend({
    count: z.number().int().min(1).max(1_000),
    prefix: z
      .string()
      .trim()
      .max(20)
      .regex(/^[A-Za-z0-9]*$/)
      .optional(),
    batchLabel: z.string().trim().max(200).optional(),
  })
export type CouponBatchInput = z.infer<typeof couponBatchSchema>

export const couponUpdateSchema = z.object({
  couponPublicId: uuidSchema,
  isActive: z.boolean().optional(),
  /** Extend: new expiry must be in the future. */
  expiresAt: z.string().datetime({ offset: true }).optional(),
})
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>

export const couponPublicIdSchema = z.object({ couponPublicId: uuidSchema })
export type CouponPublicIdInput = z.infer<typeof couponPublicIdSchema>

// ── S-8.4 Affiliates ─────────────────────────────────────────────────────────

export const affiliateInviteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(320),
  audience: z.string().trim().max(2_000).optional(),
  channels: z.string().trim().max(2_000).optional(),
})
export type AffiliateInviteInput = z.infer<typeof affiliateInviteSchema>

export const affiliateDecisionSchema = z.object({
  affiliatePublicId: uuidSchema,
  decision: z.enum(['approve', 'decline']),
  note: z.string().trim().max(500).optional(),
})
export type AffiliateDecisionInput = z.infer<typeof affiliateDecisionSchema>

export const affiliateStatusChangeSchema = z.object({
  affiliatePublicId: uuidSchema,
  status: z.enum(['approved', 'suspended']),
})
export type AffiliateStatusChangeInput = z.infer<typeof affiliateStatusChangeSchema>

export const affiliateFraudSchema = z.object({
  affiliatePublicId: uuidSchema,
  hold: z.boolean(),
})
export type AffiliateFraudInput = z.infer<typeof affiliateFraudSchema>

export const affiliateLinkSchema = z.object({
  affiliatePublicId: uuidSchema,
  coursePublicId: uuidSchema.optional(),
})
export type AffiliateLinkInput = z.infer<typeof affiliateLinkSchema>

export const programSettingsSchema = z.object({
  commissionPercent: z.number().min(1).max(99),
  cookieWindowDays: z.number().int().min(1).max(365),
  payoutThreshold: z.number().min(0),
  payoutMethod: z.enum(['bank_transfer', 'manual', 'gift_card']),
})
export type ProgramSettingsInput = z.infer<typeof programSettingsSchema>

// ── S-8.5 Testimonials ───────────────────────────────────────────────────────

export const testimonialQuerySchema = z.object({
  status: z.enum(['pending', 'published']).default('pending'),
  course: z.union([z.literal('all'), uuidSchema]).default('all'),
})
export type TestimonialQueryInput = z.infer<typeof testimonialQuerySchema>

export const testimonialDecisionSchema = z.object({
  testimonialPublicId: uuidSchema,
  decision: z.enum(['approve', 'edit', 'reject']),
  quote: z.string().trim().min(20).max(400).optional(),
  /** Editor initials / short note recorded with light edits (S-8.5). */
  editNote: z.string().trim().max(200).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
})
export type TestimonialDecisionInput = z.infer<typeof testimonialDecisionSchema>

export const testimonialFeatureSchema = z.object({
  testimonialPublicId: uuidSchema,
  featured: z.boolean(),
})
export type TestimonialFeatureInput = z.infer<typeof testimonialFeatureSchema>

export const testimonialCollectSchema = z.object({
  studentId: z.string().min(1),
  coursePublicId: uuidSchema,
  quote: z.string().trim().min(20, 'Quote must be at least 20 characters').max(400),
  rating: z.number().int().min(1).max(5).optional(),
  /** Staff verifies consent at collection time. */
  consentConfirmed: z.boolean().default(false),
})
export type TestimonialCollectInput = z.infer<typeof testimonialCollectSchema>

export const testimonialSettingsSchema = z.object({
  onCompletion: z.boolean(),
  onFiveStar: z.boolean(),
  displayFormat: z.enum(['carousel', 'grid', 'highlight']),
})
export type TestimonialSettingsInput = z.infer<typeof testimonialSettingsSchema>
