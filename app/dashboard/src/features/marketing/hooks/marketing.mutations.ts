import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import type { QueryKey } from '@tanstack/react-query'
import {
  cancelScheduledCampaign,
  collectTestimonialManually,
  createCampaign,
  createCoupon,
  createFromPrebuilt,
  decideAffiliate,
  decideTestimonial,
  duplicateCampaign,
  flagAffiliateFraud,
  generateAffiliateLink,
  generateCouponBatch,
  inviteAffiliate,
  previewAudience,
  runPayouts,
  saveProgramSettings,
  saveTemplate,
  saveTestimonialSettings,
  scheduleCampaign,
  sendCampaignNow,
  sendTestCampaign,
  sendTestTemplate,
  setTestimonialFeatured,
  updateAffiliateStatus,
  updateCampaign,
  updateCoupon,
} from '../server/all'
import type {
  AffiliateDecisionInput,
  AffiliateFraudInput,
  AffiliateInviteInput,
  AffiliateLinkInput,
  AffiliateStatusChangeInput,
  AudiencePreviewInput,
  CampaignCreateInput,
  CampaignPublicIdInput,
  CampaignScheduleInput,
  CampaignSendTestInput,
  CampaignUpdateInput,
  CouponBatchInput,
  CouponCreateInput,
  CouponUpdateInput,
  ProgramSettingsInput,
  TemplatePublicIdInput,
  TemplateSaveInput,
  TestimonialCollectInput,
  TestimonialDecisionInput,
  TestimonialFeatureInput,
  TestimonialSettingsInput,
} from '../schemas/marketing.schema'
import { marketingQueryKeys } from './marketing.queries'

/**
 * Mutation hooks for Marketing & Growth (spec 10). Every mutation funnels
 * through a shared wrapper that invalidates the given keys, toasts success,
 * and strips server error codes (`CODE: message`) — matching the
 * courses/students conventions.
 */

function stripErrorCode(message: string): string {
  return message.replace(/^[A-Z_]+:\s*/, '')
}

export function useMarketingMutation<TInput, TOutput>(options: {
  mutationFn: (input: TInput) => Promise<TOutput>
  invalidate: QueryKey[]
  successToast?: string
  onSuccess?: (output: TOutput, input: TInput) => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (output, input) => {
      options.invalidate.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      if (options.successToast) toast.success(options.successToast)
      options.onSuccess?.(output, input)
    },
    onError: (cause) => {
      toast.error(
        cause instanceof Error ? stripErrorCode(cause.message) : 'Something went wrong. Retry?',
      )
    },
  })
}

// ── S-8.1 Campaigns ──────────────────────────────────────────────────────────

export function useCreateCampaign() {
  return useMarketingMutation<CampaignCreateInput, { campaignPublicId: string }>({
    mutationFn: (input) => createCampaign({ data: input }),
    invalidate: [marketingQueryKeys.campaigns('all')],
    successToast: 'Campaign drafted.',
  })
}

export function useUpdateCampaign() {
  return useMarketingMutation<CampaignUpdateInput, { ok: true }>({
    mutationFn: (input) => updateCampaign({ data: input }),
    invalidate: [marketingQueryKeys.campaigns('all')],
    successToast: 'Campaign updated.',
  })
}

export function useScheduleCampaign() {
  return useMarketingMutation<CampaignScheduleInput, { ok: true }>({
    mutationFn: (input) => scheduleCampaign({ data: input }),
    invalidate: [marketingQueryKeys.campaigns('all')],
    successToast: 'Campaign scheduled.',
  })
}

export function useCancelScheduledCampaign() {
  return useMarketingMutation<CampaignPublicIdInput, { ok: true }>({
    mutationFn: (input) => cancelScheduledCampaign({ data: input }),
    invalidate: [marketingQueryKeys.campaigns('all')],
    successToast: 'Scheduled send cancelled.',
  })
}

export function useDuplicateCampaign() {
  return useMarketingMutation<CampaignPublicIdInput, { campaignPublicId: string }>({
    mutationFn: (input) => duplicateCampaign({ data: input }),
    invalidate: [marketingQueryKeys.campaigns('all')],
    successToast: 'Campaign duplicated as a draft.',
  })
}

export function useSendCampaignNow() {
  return useMarketingMutation<CampaignPublicIdInput, { recipientCount: number }>({
    mutationFn: (input) => sendCampaignNow({ data: input }),
    invalidate: [marketingQueryKeys.campaigns('all')],
    onSuccess: (output) => {
      toast.success(`Campaign sent to ${output.recipientCount} recipients.`)
    },
  })
}

export function useSendTestCampaign() {
  return useMarketingMutation<CampaignSendTestInput, { ok: true }>({
    mutationFn: (input) => sendTestCampaign({ data: input }),
    invalidate: [],
    successToast: 'Test email sent — check your inbox.',
  })
}

export function usePreviewAudience() {
  return useMarketingMutation<
    AudiencePreviewInput,
    {
      count: number
      matched: number
      sample: Array<{ id: string; name: string; email: string }>
    }
  >({
    mutationFn: (input) => previewAudience({ data: input }),
    invalidate: [],
  })
}

// ── S-8.2 Templates ──────────────────────────────────────────────────────────

export function useSaveTemplate() {
  return useMarketingMutation<
    TemplateSaveInput,
    { templatePublicId: string; version: number | null }
  >({
    mutationFn: (input) => saveTemplate({ data: input }),
    invalidate: [marketingQueryKeys.templates(), marketingQueryKeys.composerReference()],
    onSuccess: (output) => {
      if (output.version != null) toast.success(`Template published as version ${output.version}.`)
    },
  })
}

export function useCreateFromPrebuilt() {
  return useMarketingMutation<{ key: string }, { templatePublicId: string }>({
    mutationFn: (input) => createFromPrebuilt({ data: input }),
    invalidate: [marketingQueryKeys.templates()],
    successToast: 'Template copy created.',
  })
}

export function useSendTestTemplate() {
  return useMarketingMutation<TemplatePublicIdInput, { ok: true }>({
    mutationFn: (input) => sendTestTemplate({ data: input }),
    invalidate: [],
    successToast: 'Test email sent — check your inbox.',
  })
}

// ── S-8.3 Coupons ────────────────────────────────────────────────────────────

export function useCreateCoupon() {
  return useMarketingMutation<CouponCreateInput, { couponPublicIds: string[]; codes: string[] }>({
    mutationFn: (input) => createCoupon({ data: input }),
    invalidate: [marketingQueryKeys.coupons('all')],
    successToast: 'Code created.',
  })
}

export function useGenerateCouponBatch() {
  return useMarketingMutation<
    CouponBatchInput,
    { codes: string[]; couponPublicIds: string[]; expiresAt: string | null }
  >({
    mutationFn: (input) => generateCouponBatch({ data: input }),
    invalidate: [marketingQueryKeys.coupons('all')],
    successToast: 'Batch generated.',
  })
}

export function useUpdateCoupon() {
  return useMarketingMutation<CouponUpdateInput, { ok: true }>({
    mutationFn: (input) => updateCoupon({ data: input }),
    invalidate: [marketingQueryKeys.coupons('all')],
    onSuccess: (_output, input) => {
      if (input.isActive === false) toast.success('Code deactivated.')
      else if (input.isActive === true) toast.success('Code reactivated.')
    },
  })
}

// ── S-8.4 Affiliates ─────────────────────────────────────────────────────────

export function useSaveProgramSettings() {
  return useMarketingMutation<ProgramSettingsInput, { ok: true }>({
    mutationFn: (input) => saveProgramSettings({ data: input }),
    invalidate: [marketingQueryKeys.affiliateProgram()],
    successToast: 'Program settings saved.',
  })
}

export function useInviteAffiliate() {
  return useMarketingMutation<AffiliateInviteInput, { affiliatePublicId: string }>({
    mutationFn: (input) => inviteAffiliate({ data: input }),
    invalidate: [marketingQueryKeys.affiliates('all'), marketingQueryKeys.affiliateProgram()],
    successToast: 'Invitation saved as a pending application.',
  })
}

export function useDecideAffiliate() {
  return useMarketingMutation<AffiliateDecisionInput, { ok: true }>({
    mutationFn: (input) => decideAffiliate({ data: input }),
    invalidate: [marketingQueryKeys.affiliates('all'), marketingQueryKeys.affiliateProgram()],
    onSuccess: (_output, input) => {
      toast.success(
        input.decision === 'approve'
          ? 'Affiliate approved — referral links are now active.'
          : 'Application declined.',
      )
    },
  })
}

export function useUpdateAffiliateStatus() {
  return useMarketingMutation<AffiliateStatusChangeInput, { ok: true }>({
    mutationFn: (input) => updateAffiliateStatus({ data: input }),
    invalidate: [marketingQueryKeys.affiliates('all')],
    successToast: 'Affiliate status updated.',
  })
}

export function useFlagAffiliateFraud() {
  return useMarketingMutation<AffiliateFraudInput, { ok: true }>({
    mutationFn: (input) => flagAffiliateFraud({ data: input }),
    invalidate: [marketingQueryKeys.affiliates('all')],
    onSuccess: (_output, input) => {
      toast.success(input.hold ? 'Commissions held for review.' : 'Commissions released.')
    },
  })
}

export function useGenerateAffiliateLink() {
  return useMarketingMutation<AffiliateLinkInput, { code: string }>({
    mutationFn: (input) => generateAffiliateLink({ data: input }),
    invalidate: [marketingQueryKeys.affiliates('all')],
    onSuccess: (output) => {
      toast.success(`Referral code ${output.code} created.`)
    },
  })
}

export function useRunPayouts() {
  return useMarketingMutation<
    void,
    {
      paidCount: number
      paidTotal: number
      currency: string
      failing: Array<{ name: string; reasons: string[] }>
    }
  >({
    mutationFn: () => runPayouts(),
    invalidate: [
      marketingQueryKeys.affiliates('all'),
      marketingQueryKeys.pendingPayouts(),
      marketingQueryKeys.payoutHistory(),
      marketingQueryKeys.affiliateProgram(),
    ],
    onSuccess: (output) => {
      if (output.paidCount === 0) {
        toast.warning('No affiliates met the payout requirements.')
      } else {
        toast.success(
          `Paid ${output.paidCount} affiliates — ${output.paidTotal} ${output.currency}.`,
        )
      }
    },
  })
}

// ── S-8.5 Testimonials ───────────────────────────────────────────────────────

export function useDecideTestimonial() {
  return useMarketingMutation<TestimonialDecisionInput, { ok: true; heavyEdit: boolean }>({
    mutationFn: (input) => decideTestimonial({ data: input }),
    invalidate: [
      marketingQueryKeys.testimonials({ status: 'pending', course: 'all' }),
      marketingQueryKeys.testimonials({ status: 'published', course: 'all' }),
    ],
    onSuccess: (output, input) => {
      if (input.decision === 'approve') toast.success('Testimonial published.')
      else if (input.decision === 'edit') toast.success('Quote edited.')
      else toast.success('Submission rejected and archived.')
      if (output.heavyEdit) {
        toast.warning('Heavy edit flagged — consider re-confirming the wording with the student.')
      }
    },
  })
}

export function useSetTestimonialFeatured() {
  return useMarketingMutation<TestimonialFeatureInput, { ok: true }>({
    mutationFn: (input) => setTestimonialFeatured({ data: input }),
    invalidate: [
      marketingQueryKeys.testimonials({ status: 'pending', course: 'all' }),
      marketingQueryKeys.testimonials({ status: 'published', course: 'all' }),
    ],
    onSuccess: (_output, input) => {
      toast.success(input.featured ? 'Featured on the landing page.' : 'Removed from featured.')
    },
  })
}

export function useCollectTestimonialManually() {
  return useMarketingMutation<TestimonialCollectInput, { testimonialPublicId: string }>({
    mutationFn: (input) => collectTestimonialManually({ data: input }),
    invalidate: [marketingQueryKeys.testimonials({ status: 'pending', course: 'all' })],
    successToast: 'Testimonial added to the moderation queue.',
  })
}

export function useSaveTestimonialSettings() {
  return useMarketingMutation<TestimonialSettingsInput, { ok: true }>({
    mutationFn: (input) => saveTestimonialSettings({ data: input }),
    invalidate: [marketingQueryKeys.testimonialSettings()],
    successToast: 'Collection settings saved.',
  })
}
