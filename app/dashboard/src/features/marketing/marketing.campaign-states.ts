import type { CampaignStatusValue } from './marketing.types'

/**
 * Campaign lifecycle rules (spec 10 S-8.1) — pure so the server enforces and
 * the UI renders the exact same transition graph. States: Draft / Scheduled /
 * Sending / Sent / Cancelled.
 *
 *   draft → scheduled | sending
 *   scheduled → sending | cancelled   (cancel only before it fires)
 *   sending → sent
 *   sent / cancelled are terminal (a sent campaign duplicates instead).
 */

const TRANSITIONS: Record<CampaignStatusValue, readonly CampaignStatusValue[]> = {
  draft: ['scheduled', 'sending'],
  scheduled: ['sending', 'cancelled'],
  sending: ['sent'],
  sent: [],
  cancelled: [],
}

export function canTransition(from: CampaignStatusValue, to: CampaignStatusValue): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Server-side guard for send/schedule/cancel handlers. */
export function assertTransition(from: CampaignStatusValue, to: CampaignStatusValue): void {
  if (!canTransition(from, to)) {
    throw new Error(`INVALID_CAMPAIGN_STATE:${from} cannot transition to ${to}`)
  }
}

/** Editing (name, subject, preheader, audience) is allowed pre-send only. */
export function isEditable(status: CampaignStatusValue): boolean {
  return status === 'draft' || status === 'scheduled'
}

/** Spec: "Duplicate a past campaign as a starting point" — any settled row. */
export function isDuplicatable(status: CampaignStatusValue): boolean {
  return status === 'draft' || status === 'sent' || status === 'cancelled'
}

/** Spec: > 500 recipients requires an S-7.1 confirmation with the count. */
export const LARGE_SEND_THRESHOLD = 500

export function requiresLargeSendConfirmation(recipientCount: number): boolean {
  return recipientCount > LARGE_SEND_THRESHOLD
}

/**
 * Spec: "Sent campaigns show 'metrics updating' shimmer for the first hour."
 * `now` is injectable for tests; ISO strings keep the helper SSR-safe.
 */
export function isMetricsUpdating(sentAt: string | null, now: Date = new Date()): boolean {
  if (!sentAt) return false
  const sent = new Date(sentAt).getTime()
  if (Number.isNaN(sent)) return false
  const oneHourMs = 60 * 60 * 1000
  return now.getTime() - sent < oneHourMs
}

/** Labels for audience segments shown in the list (spec: audience column). */
export function describeAudience(audience: {
  cohortPublicIds: string[]
  coursePublicIds: string[]
  tags: string[]
  activity: 'any' | 'active_30d' | 'inactive_30d' | 'completed'
}): string {
  const parts: string[] = []
  if (audience.cohortPublicIds.length > 0) {
    parts.push(
      `${audience.cohortPublicIds.length} cohort${audience.cohortPublicIds.length > 1 ? 's' : ''}`,
    )
  }
  if (audience.coursePublicIds.length > 0) {
    parts.push(
      `${audience.coursePublicIds.length} course${audience.coursePublicIds.length > 1 ? 's' : ''}`,
    )
  }
  if (audience.tags.length > 0) parts.push(`tags: ${audience.tags.join(', ')}`)
  if (audience.activity !== 'any') {
    parts.push(ACTIVITY_LABELS[audience.activity])
  }
  return parts.length > 0 ? parts.join(' · ') : 'All contacts'
}

export const ACTIVITY_LABELS = {
  any: 'All contacts',
  active_30d: 'Active in last 30 days',
  inactive_30d: 'Inactive for 30+ days',
  completed: 'Completed at least one course',
} as const
