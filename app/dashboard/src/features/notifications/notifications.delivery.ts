/**
 * Notification Delivery contract (spec 08 § S-6.1, spec 11 § Notification
 * Delivery).
 *
 * Every notification has three channels: in-app, Telegram, email. The
 * contract: in-app always, Telegram by default, email only when verified.
 * This module underpins S-6.1 notification prefs, S-6.2 invites, S-6.10
 * retention warnings, and S-6.11 export notifications.
 */

export type NotificationChannel = 'in_app' | 'telegram' | 'email'

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-app',
  telegram: 'Telegram',
  email: 'Email',
}

export type ChannelAvailability =
  | { readonly kind: 'available' }
  | { readonly kind: 'disabled'; readonly reason: string }
  | { readonly kind: 'unavailable'; readonly reason: string }

export interface UserProfile {
  readonly hasTelegram: boolean
  readonly telegramVerified: boolean
  readonly email: string | null
  readonly emailVerified: boolean
}

export type DeliveryState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'delivered'; readonly at: number }
  | { readonly kind: 'failed'; readonly error: string; readonly retryable: boolean }
  | { readonly kind: 'suppressed'; readonly reason: string }

export interface NotificationIntent {
  readonly type: string
  readonly channels: readonly NotificationChannel[]
  readonly recipient: UserProfile
}

export interface ChannelPlan {
  readonly channel: NotificationChannel
  readonly availability: ChannelAvailability
}

/**
 * Compute channel availability for a recipient. In-app is always available;
 * Telegram requires a verified handle; email requires a verified address.
 */
export function planChannelDelivery(intent: NotificationIntent): readonly ChannelPlan[] {
  return intent.channels.map((channel): ChannelPlan => {
    if (channel === 'in_app') return { channel, availability: { kind: 'available' } }
    if (channel === 'telegram') {
      if (!intent.recipient.hasTelegram)
        return {
          channel,
          availability: { kind: 'unavailable', reason: 'No Telegram handle linked' },
        }
      if (!intent.recipient.telegramVerified)
        return { channel, availability: { kind: 'disabled', reason: 'Telegram not verified' } }
      return { channel, availability: { kind: 'available' } }
    }
    // email
    if (!intent.recipient.email)
      return { channel, availability: { kind: 'unavailable', reason: 'No email address on file' } }
    if (!intent.recipient.emailVerified)
      return { channel, availability: { kind: 'disabled', reason: 'Email not verified' } }
    return { channel, availability: { kind: 'available' } }
  })
}

export interface DispatchSummary {
  readonly delivered: readonly NotificationChannel[]
  readonly failed: readonly { channel: NotificationChannel; error: string }[]
  readonly suppressed: readonly { channel: NotificationChannel; reason: string }[]
  readonly pending: readonly NotificationChannel[]
}

export function summarizeDispatch(
  plans: readonly ChannelPlan[],
  states: ReadonlyMap<NotificationChannel, DeliveryState>,
): DispatchSummary {
  const delivered: NotificationChannel[] = []
  const failed: { channel: NotificationChannel; error: string }[] = []
  const suppressed: { channel: NotificationChannel; reason: string }[] = []
  const pending: NotificationChannel[] = []
  for (const plan of plans) {
    const state = states.get(plan.channel)
    if (!state) {
      pending.push(plan.channel)
      continue
    }
    if (state.kind === 'delivered') delivered.push(plan.channel)
    else if (state.kind === 'failed') failed.push({ channel: plan.channel, error: state.error })
    else if (state.kind === 'suppressed')
      suppressed.push({ channel: plan.channel, reason: state.reason })
    else pending.push(plan.channel)
  }
  return { delivered, failed, suppressed, pending }
}

/**
 * Whether a channel failure is retryable (transient) vs suppressed (permanent).
 */
export function isRetryableFailure(_channel: NotificationChannel, state: DeliveryState): boolean {
  if (state.kind !== 'failed') return false
  return state.retryable
}

/**
 * The "no reachable channel" state — every channel is unavailable or suppressed.
 */
export function hasNoReachableChannel(plans: readonly ChannelPlan[]): boolean {
  return plans.every((p) => p.availability.kind !== 'available')
}
