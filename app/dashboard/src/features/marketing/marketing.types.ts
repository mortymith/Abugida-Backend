import type { CampaignAudience } from '@abugida/database/marketing'

/**
 * DTOs returned by the Marketing server functions and consumed by the
 * views. Dates are ISO strings; numeric aggregates arrive as numbers so
 * the client never re-parses database decimals.
 */

// ── S-8.1 Campaigns ──────────────────────────────────────────────────────────

export type CampaignStatusValue = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'

export interface CampaignRow {
  publicId: string
  name: string
  subject: string
  preheader: string | null
  status: CampaignStatusValue
  audience: CampaignAudience
  audienceLabel: string
  templatePublicId: string | null
  templateName: string | null
  scheduledFor: string | null
  sentAt: string | null
  recipientCount: number | null
  /** Open/click rates in percent — null while metrics are still updating. */
  openRate: number | null
  clickRate: number | null
  createdAt: string
}

/** delivered → opened → clicked → enrolled funnel (S-8.1 detail panel). */
export interface CampaignFunnel {
  recipients: number
  delivered: number | null
  opened: number | null
  clicked: number | null
  enrollments: number
  /** Open/click events depend on provider webhooks; null = not measurable yet. */
  metricsUpdating: boolean
}

export interface CampaignLinkClick {
  label: string
  url: string
  clicks: number
}

export interface CampaignDetail extends CampaignRow {
  funnel: CampaignFunnel
  linkClicks: CampaignLinkClick[]
}

export interface AudiencePreview {
  /** Final deliverable count after consent/suppression filtering. */
  count: number
  /** Population before suppression — shown so the difference is visible. */
  matched: number
  sample: Array<{ id: string; name: string; email: string }>
}

// ── S-8.2 Templates ──────────────────────────────────────────────────────────

export type TemplateKindValue =
  | 'welcome'
  | 'announcement'
  | 'reminder'
  | 'promotion'
  | 'certificate_issued'
  | 're_engagement'
  | 'custom'

export interface TemplateListRow {
  publicId: string
  name: string
  kind: TemplateKindValue
  currentVersion: number
  subject: string | null
  usageCount: number
  updatedAt: string
}

export interface TemplateDetail extends TemplateListRow {
  preheader: string | null
  document: {
    blocks: TemplateBlockView[]
    footer: { type: 'footer' }
  } | null
  versions: Array<{
    version: number
    subject: string
    publishedAt: string
  }>
}

export interface TemplateBlockView {
  type: 'hero' | 'text' | 'button' | 'course_card'
  heading?: string
  subheading?: string | null
  body?: string
  label?: string
  url?: string
  coursePublicId?: string | null
}

export interface TemplatePreviewStudent {
  id: string
  firstName: string
  courseName: string
  startDate: string | null
}

// ── S-8.3 Coupons ────────────────────────────────────────────────────────────

export type CouponKindValue = 'percentage' | 'fixed' | 'full_access'
export type CouponStateValue = 'active' | 'expired' | 'deactivated' | 'exhausted'

export interface CouponScopeCourse {
  publicId: string
  title: string
}

export interface CouponRow {
  publicId: string
  code: string
  kind: CouponKindValue
  value: number | null
  currency: string
  scope: CouponScopeCourse[]
  maxRedemptions: number | null
  redemptionCount: number
  expiresAt: string | null
  stackable: boolean
  isActive: boolean
  state: CouponStateValue
  /** Completed-purchase revenue attributed to the code. */
  revenueInfluenced: number
  batchId: string | null
  batchLabel: string | null
  createdAt: string
}

export interface CouponRedemptionRow {
  id: string
  studentName: string
  courseTitle: string | null
  amountDiscounted: number
  currency: string
  redeemedAt: string
}

// ── S-8.4 Affiliates ─────────────────────────────────────────────────────────

export type AffiliateStatusValue = 'pending' | 'approved' | 'suspended' | 'declined'

export interface AffiliateProgramSummary {
  settings: AffiliateProgramSettings
  pendingApplications: number
  pendingPayoutTotal: number
  currency: string
}

export interface AffiliateProgramSettings {
  commissionPercent: number
  cookieWindowDays: number
  payoutThreshold: number
  payoutMethod: string
}

export interface AffiliateRow {
  publicId: string
  name: string
  email: string
  status: AffiliateStatusValue
  audience: string | null
  channels: string | null
  decisionNote: string | null
  clicks: number
  sales: number
  revenue: number
  owed: number
  commissionsHeld: boolean
  fraudFlaggedAt: string | null
  fraudEvidence: { reason: string; detail?: string } | null
  links: Array<{ code: string; courseTitle: string | null }>
  currency: string
}

export interface PayoutRunRow {
  affiliatePublicId: string
  name: string
  owed: number
  eligible: boolean
  reasons: string[]
}

export interface PayoutRunResult {
  paidCount: number
  paidTotal: number
  currency: string
  failing: PayoutRunRow[]
}

export interface PayoutHistoryRow {
  publicId: string
  affiliateName: string
  amount: number
  currency: string
  method: string
  status: 'pending' | 'paid' | 'failed'
  reference: string | null
  processedAt: string | null
  createdAt: string
}

// ── S-8.5 Testimonials ───────────────────────────────────────────────────────

export type TestimonialStatusValue = 'pending' | 'published' | 'rejected' | 'archived'

export interface TestimonialRow {
  publicId: string
  studentId: string
  studentName: string
  coursePublicId: string
  courseTitle: string
  courseRating: number | null
  quote: string
  rating: number | null
  consentConfirmed: boolean
  status: TestimonialStatusValue
  featured: boolean
  heavyEdit: boolean
  editNote: string | null
  rejectionReason: string | null
  trigger: 'completion' | 'five_star_rating' | 'manual'
  publishedAt: string | null
  createdAt: string
}

export interface TestimonialSettings {
  onCompletion: boolean
  onFiveStar: boolean
  displayFormat: 'carousel' | 'grid' | 'highlight'
}

export interface TestimonialRequestRow {
  publicId: string
  studentName: string
  courseTitle: string
  trigger: 'completion' | 'five_star_rating' | 'manual'
  status: 'open' | 'submitted' | 'dismissed'
  requestedAt: string
}
