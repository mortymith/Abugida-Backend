/**
 * S-8.1 Campaign multi-channel logic (spec 10 Rev-3). Per-channel breakdown,
 * exclusions, send-delay countdown, cancel-mid-send.
 */

export interface ExclusionBreakdown {
  readonly excludedCount: number
  readonly reasons: {
    readonly unsubscribed: number
    readonly no_verified_channel: number
    readonly already_enrolled: number
  }
}

export function computeExclusions(
  _audienceSize: number,
  suppressions: { unsubscribed: number; noVerifiedChannel: number; alreadyEnrolled: number },
): ExclusionBreakdown {
  const excludedCount =
    suppressions.unsubscribed + suppressions.noVerifiedChannel + suppressions.alreadyEnrolled
  return {
    excludedCount,
    reasons: {
      unsubscribed: suppressions.unsubscribed,
      no_verified_channel: suppressions.noVerifiedChannel,
      already_enrolled: suppressions.alreadyEnrolled,
    },
  }
}

export function formatExclusionBreakdown(e: ExclusionBreakdown): string {
  if (e.excludedCount === 0) return ''
  const parts: string[] = []
  if (e.reasons.unsubscribed > 0) parts.push(`${e.reasons.unsubscribed} unsubscribed`)
  if (e.reasons.no_verified_channel > 0)
    parts.push(`${e.reasons.no_verified_channel} no verified channel`)
  if (e.reasons.already_enrolled > 0) parts.push(`${e.reasons.already_enrolled} already enrolled`)
  return `${e.excludedCount} excluded: ${parts.join(', ')}`
}

export const SEND_DELAY_THRESHOLD = 100
export const SEND_DELAY_MS = 10_000

export function shouldShowSendDelay(recipientCount: number): boolean {
  return recipientCount > SEND_DELAY_THRESHOLD
}

export function canCancelMidSend(campaignStatus: string): boolean {
  return campaignStatus === 'sending'
}

export function shouldBlockRetryFailed(
  parentCampaignId: string | null,
  existingRetryCampaignIds: string[],
): boolean {
  if (!parentCampaignId) return false
  return existingRetryCampaignIds.includes(parentCampaignId)
}
