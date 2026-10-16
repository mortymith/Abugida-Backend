/**
 * Message delivery model logic (spec 06 § S-4.5 — "A delivery is a row,
 * not a boolean on the message").
 *
 * A message to one recipient creates up to 3 delivery rows (in_app,
 * telegram, email). Each row tracks its own state independently:
 * `pending → delivered → read` or `pending → failed`.
 *
 * This module owns:
 * 1. The delivery-row creation logic (which channels to create rows for).
 * 2. The 7-day dormancy → Telegram relay decision.
 * 3. The read-receipt merge logic (a message read in-app after being
 *    delivered over Telegram reads "Read" once, with the channel noted).
 * 4. The "Not delivered — no verified contact" state.
 */

export type DeliveryChannel = 'in_app' | 'telegram' | 'email'
export type DeliveryState = 'pending' | 'delivered' | 'read' | 'failed'

export interface DeliveryRow {
  readonly messageId: string
  readonly recipientId: string
  readonly channel: DeliveryChannel
  readonly state: DeliveryState
  readonly deliveredAt: number | null
  readonly readAt: number | null
  readonly failureReason: string | null
}

export interface RecipientChannelProfile {
  readonly hasInApp: boolean // always true — every student has an in-app feed
  readonly hasTelegram: boolean
  readonly telegramVerified: boolean
  readonly hasEmail: boolean
  readonly emailVerified: boolean
  readonly lastAppOpenAt: number | null // epoch ms; null = never opened
}

export interface DeliveryPlan {
  readonly channels: readonly DeliveryChannel[]
  readonly willRelayToTelegram: boolean
  readonly willRelayToEmail: boolean
  readonly noReachableChannel: boolean
}

/**
 * The 7-day dormancy threshold (spec S-4.5: "has not opened the app in
 * 7 days"). A student who opened the app yesterday gets in-app only; a
 * student who has not opened it in three weeks gets the Telegram nudge.
 */
export const DORMANCY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Plan the delivery rows for a message to one recipient. The spec:
 * - In-app is always created (it's the system of record).
 * - Telegram is created only when the student has a verified handle AND
 *   has been dormant for 7+ days (the relay rule).
 * - Email is created only when the student has a verified address AND
 *   has been dormant for 7+ days.
 *
 * If no channel is reachable (no in-app — impossible — or no verified
 * contact for relay), the message is NOT sent and the thread shows
 * "Not delivered — no verified contact."
 */
export function planDelivery(profile: RecipientChannelProfile, now: number): DeliveryPlan {
  const isDormant = isDormantForRelay(profile, now)
  const willRelayToTelegram = profile.hasTelegram && profile.telegramVerified && isDormant
  const willRelayToEmail = profile.hasEmail && profile.emailVerified && isDormant

  const channels: DeliveryChannel[] = ['in_app']
  if (willRelayToTelegram) channels.push('telegram')
  if (willRelayToEmail) channels.push('email')

  // In-app is always reachable, so noReachableChannel is only true when
  // the in-app feed is somehow unavailable (should never happen, but
  // guard anyway).
  const noReachableChannel = !profile.hasInApp && !willRelayToTelegram && !willRelayToEmail

  return { channels, willRelayToTelegram, willRelayToEmail, noReachableChannel }
}

/**
 * Whether the student has been dormant long enough to trigger the
 * Telegram/email relay. 7 days since last app open.
 */
export function isDormantForRelay(profile: RecipientChannelProfile, now: number): boolean {
  if (profile.lastAppOpenAt === null) return true // never opened → dormant
  return now - profile.lastAppOpenAt >= DORMANCY_THRESHOLD_MS
}

/**
 * Merge read receipts across channels. The spec: "A message that was
 * delivered over Telegram and read in-app reads Read once, with the
 * channel noted — not two receipts."
 *
 * A message is "read" when ANY delivery row reaches `read` state. The
 * displayed channel is the one that was read first (or the only one).
 */
export function mergeReadReceipts(deliveries: readonly DeliveryRow[]): {
  isRead: boolean
  readAt: number | null
  readChannel: DeliveryChannel | null
} {
  const readDeliveries = deliveries.filter((d) => d.state === 'read')
  if (readDeliveries.length === 0) {
    return { isRead: false, readAt: null, readChannel: null }
  }
  // Pick the earliest read timestamp.
  const earliest = readDeliveries.reduce((min, d) =>
    (d.readAt ?? Number.MAX_SAFE_INTEGER) < (min.readAt ?? Number.MAX_SAFE_INTEGER) ? d : min,
  )
  return {
    isRead: true,
    readAt: earliest.readAt,
    readChannel: earliest.channel,
  }
}

/**
 * The delivery-state label for a message. The spec: "Delivered ✓ → Read,
 * with the read time in the Part 11 time format."
 */
export function deliveryStateLabel(deliveries: readonly DeliveryRow[]): string {
  const { isRead } = mergeReadReceipts(deliveries)
  if (isRead) return 'Read'
  const anyDelivered = deliveries.some((d) => d.state === 'delivered')
  if (anyDelivered) return 'Delivered ✓'
  const anyFailed = deliveries.every((d) => d.state === 'failed')
  if (anyFailed) return 'Not delivered'
  return 'Sending…'
}

/**
 * Whether a message has a delivery failure that should be surfaced. The
 * spec: "per recipient, not as a single success toast — '{name} has no
 * email on file — sent in-app and via Telegram.'"
 */
export function deliveryFailureSummary(
  deliveries: readonly DeliveryRow[],
  profile: RecipientChannelProfile,
): string | null {
  const failed = deliveries.filter((d) => d.state === 'failed')
  if (failed.length === 0) return null

  const reasons: string[] = []
  if (failed.some((d) => d.channel === 'email')) {
    if (!profile.hasEmail) {
      reasons.push('no email on file')
    } else if (!profile.emailVerified) {
      reasons.push('email not verified')
    }
  }
  if (failed.some((d) => d.channel === 'telegram')) {
    if (!profile.hasTelegram) {
      reasons.push('no Telegram handle linked')
    } else if (!profile.telegramVerified) {
      reasons.push('Telegram not verified')
    }
  }
  if (reasons.length === 0) return null
  return `Not delivered — ${reasons.join(', ')}`
}
