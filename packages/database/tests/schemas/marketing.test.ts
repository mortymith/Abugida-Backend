import { describe, it, expect } from 'bun:test'
import {
  insertCampaignSchema,
  insertEmailTemplateSchema,
  insertEmailTemplateVersionSchema,
  insertCouponSchema,
  insertAffiliateSchema,
  insertCommissionSchema,
  insertPayoutSchema,
  insertTestimonialSchema,
  campaignAudienceSchema,
  campaignStatusEnum,
  campaignSendStatusEnum,
  campaignEventTypeEnum,
  templateKindEnum,
  couponKindEnum,
  affiliateStatusEnum,
  commissionStatusEnum,
  payoutStatusEnum,
  testimonialStatusEnum,
  testimonialTriggerEnum,
  templateDocumentSchema,
} from '../../schema/marketing'

describe('marketing schemas', () => {
  describe('email templates', () => {
    it('accepts a valid template insert', () => {
      const result = insertEmailTemplateSchema.safeParse({
        name: 'Course Announcement',
        kind: 'announcement',
      })
      expect(result.success).toBe(true)
    })

    it('rejects subject drafts over 150 characters', () => {
      const result = insertEmailTemplateSchema.safeParse({
        name: 'T',
        draftSubject: 'x'.repeat(151),
      })
      expect(result.success).toBe(false)
    })

    it('accepts a version with subject and document', () => {
      const result = insertEmailTemplateVersionSchema.safeParse({
        templateId: 1,
        version: 1,
        subject: 'Hello',
        document: {
          blocks: [{ type: 'text', body: 'Hi {{first_name}}' }],
          footer: { type: 'footer' },
        },
      })
      expect(result.success).toBe(true)
    })

    it('rejects documents with more than one hero block', () => {
      const document = {
        blocks: [
          { type: 'hero', heading: 'A' },
          { type: 'hero', heading: 'B' },
        ],
        footer: { type: 'footer' },
      }
      const result = templateDocumentSchema.safeParse(document)
      expect(result.success).toBe(false)
    })

    it('requires the footer block in the document', () => {
      const result = templateDocumentSchema.safeParse({
        blocks: [{ type: 'text', body: 'Hello' }],
      })
      expect(result.success).toBe(false)
    })

    it('exposes every template kind', () => {
      expect(templateKindEnum.options).toContain('certificate_issued')
      expect(templateKindEnum.options).toContain('re_engagement')
    })
  })

  describe('campaigns', () => {
    const validAudience = {
      cohortPublicIds: [],
      coursePublicIds: ['a1111111-1111-4111-8111-111111111111'],
      tags: ['toefl-jan'],
      activity: 'active_30d' as const,
    }

    it('accepts a valid campaign insert', () => {
      const result = insertCampaignSchema.safeParse({
        name: 'Sept TOEFL push',
        subject: 'Seats are open',
        audience: validAudience,
      })
      expect(result.success).toBe(true)
    })

    it('rejects subjects over 150 characters', () => {
      const result = insertCampaignSchema.safeParse({
        name: 'C',
        subject: 'y'.repeat(151),
        audience: validAudience,
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown audience fields (strict segment)', () => {
      const result = campaignAudienceSchema.safeParse({ ...validAudience, hack: true })
      expect(result.success).toBe(false)
    })

    it('rejects invalid activity filters', () => {
      const result = campaignAudienceSchema.safeParse({ ...validAudience, activity: 'yesterday' })
      expect(result.success).toBe(false)
    })

    it('exposes the spec lifecycle statuses', () => {
      expect(campaignStatusEnum.options).toEqual([
        'draft',
        'scheduled',
        'sending',
        'sent',
        'cancelled',
      ])
    })

    it('exposes send and event types', () => {
      expect(campaignSendStatusEnum.options).toContain('queued')
      expect(campaignEventTypeEnum.options).toEqual([
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'unsubscribed',
      ])
    })
  })

  describe('coupons', () => {
    it('accepts a percentage coupon', () => {
      const result = insertCouponSchema.safeParse({
        code: 'TOEFL25',
        kind: 'percentage',
        value: 25,
      })
      expect(result.success).toBe(true)
    })

    it('accepts a full-access coupon without a value', () => {
      const result = insertCouponSchema.safeParse({ code: 'FREE-01', kind: 'full_access' })
      expect(result.success).toBe(true)
    })

    it('rejects codes with characters outside the allowed alphabet', () => {
      const result = insertCouponSchema.safeParse({
        code: 'BAD CODE!',
        kind: 'percentage',
        value: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects too-short codes', () => {
      const result = insertCouponSchema.safeParse({ code: 'AB', kind: 'percentage', value: 10 })
      expect(result.success).toBe(false)
    })

    it('exposes the three discount kinds', () => {
      expect(couponKindEnum.options).toEqual(['percentage', 'fixed', 'full_access'])
    })
  })

  describe('affiliates', () => {
    it('accepts a valid application', () => {
      const result = insertAffiliateSchema.safeParse({
        name: 'Sara B.',
        email: 'sara@example.com',
        audience: 'TOEFL learners',
        channels: 'YouTube',
      })
      expect(result.success).toBe(true)
    })

    it('defaults new applications to pending', () => {
      const parsed = insertAffiliateSchema.parse({
        name: 'Daniel W.',
        email: 'daniel@example.com',
      })
      expect(parsed.status).toBe('pending')
    })

    it('rejects invalid email addresses', () => {
      const result = insertAffiliateSchema.safeParse({ name: 'X', email: 'not-an-email' })
      expect(result.success).toBe(false)
    })

    it('accepts a commission snapshot', () => {
      const result = insertCommissionSchema.safeParse({
        affiliateId: 1,
        rate: 20,
        amount: 425.6,
      })
      expect(result.success).toBe(true)
    })

    it('rejects commission rates above 100', () => {
      const result = insertCommissionSchema.safeParse({
        affiliateId: 1,
        rate: 120,
        amount: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects zero-amount payouts', () => {
      const result = insertPayoutSchema.safeParse({
        affiliateId: 1,
        amount: 0,
        method: 'bank_transfer',
      })
      expect(result.success).toBe(false)
    })

    it('exposes commission and payout statuses', () => {
      expect(commissionStatusEnum.options).toEqual(['pending', 'held', 'paid', 'reversed'])
      expect(payoutStatusEnum.options).toEqual(['pending', 'paid', 'failed'])
    })

    it('exposes affiliate statuses including declined', () => {
      expect(affiliateStatusEnum.options).toEqual(['pending', 'approved', 'suspended', 'declined'])
    })
  })

  describe('testimonials', () => {
    it('accepts a valid pending testimonial', () => {
      const result = insertTestimonialSchema.safeParse({
        studentId: 'user-1',
        courseId: 1,
        quote: 'The 12-week plan took me from 79 to 101.',
        rating: 5,
      })
      expect(result.success).toBe(true)
    })

    it('rejects quotes shorter than 20 characters', () => {
      const result = insertTestimonialSchema.safeParse({
        studentId: 'user-1',
        courseId: 1,
        quote: 'Too short',
      })
      expect(result.success).toBe(false)
    })

    it('rejects quotes longer than 400 characters', () => {
      const result = insertTestimonialSchema.safeParse({
        studentId: 'user-1',
        courseId: 1,
        quote: 'q'.repeat(401),
      })
      expect(result.success).toBe(false)
    })

    it('rejects ratings outside 1-5', () => {
      const result = insertTestimonialSchema.safeParse({
        studentId: 'user-1',
        courseId: 1,
        quote: 'A perfectly reasonable length quote.',
        rating: 9,
      })
      expect(result.success).toBe(false)
    })

    it('defaults consent to unconfirmed', () => {
      const parsed = insertTestimonialSchema.parse({
        studentId: 'user-1',
        courseId: 1,
        quote: 'A perfectly reasonable length quote.',
      })
      expect(parsed.consentConfirmed).toBe(false)
    })

    it('exposes the spec states and triggers', () => {
      expect(testimonialStatusEnum.options).toEqual([
        'pending',
        'published',
        'rejected',
        'archived',
      ])
      expect(testimonialTriggerEnum.options).toEqual(['completion', 'five_star_rating', 'manual'])
    })
  })
})
