/**
 * Marketing instrumentation (spec 10 § Instrumentation & acceptance).
 * No PII: no names, no emails, no handles, no quote text, no payout amounts.
 */

export const MARKETING_INSTRUMENTATION_EVENTS = [
  'campaign_composed',
  'campaign_sent',
  'campaign_cancelled',
  'campaign_duplicated',
  'template_saved',
  'template_published',
  'template_test_sent',
  'coupon_generated',
  'coupon_revoked',
  'coupon_deactivated',
  'affiliate_invited',
  'affiliate_approved',
  'affiliate_suspended',
  'payout_run_started',
  'payout_completed',
  'payout_retried',
  'testimonial_published',
  'testimonial_rejected',
  'testimonial_featured',
  'testimonial_edit_classified',
  'testimonial_reconfirmation_sent',
] as const

export type MarketingInstrumentationEvent = (typeof MARKETING_INSTRUMENTATION_EVENTS)[number]

export interface MarketingPayload {
  readonly id: string
  readonly count?: number
  readonly [key: string]: unknown
}

const FORBIDDEN_KEYS = new Set([
  'name',
  'email',
  'handle',
  'phone',
  'address',
  'body',
  'text',
  'content',
  'note',
  'secret',
  'token',
  'password',
  'quote',
  'amount',
  'reason',
])

export function validateMarketingPayload(payload: MarketingPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string' || payload.id.length === 0)
    return 'Marketing payload must have a non-empty string `id`'
  for (const key of Object.keys(payload))
    if (FORBIDDEN_KEYS.has(key))
      return `Marketing payload must not include key "${key}" (PII or content leak)`
  if (payload.count !== undefined && typeof payload.count !== 'number')
    return 'Marketing payload `count` must be a number'
  return null
}

export function trackMarketingEvent(
  event: MarketingInstrumentationEvent,
  payload: MarketingPayload,
  send: (event: string, payload: MarketingPayload) => void,
): void {
  const error = validateMarketingPayload(payload)
  if (error !== null) {
    console.warn(`[marketing-instrumentation] ${event}: ${error}`)
    return
  }
  send(event, payload)
}
