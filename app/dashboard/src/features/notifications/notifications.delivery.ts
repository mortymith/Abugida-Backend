/**
 * Notification Delivery contract (spec 04 § Notification Delivery, spec 11
 * § Notification Delivery).
 *
 * Every notification has three channels: in-app, Telegram, email. The
 * contract is:
 *
 * - **In-app:** always delivered. There is no "in-app unavailable" state.
 * - **Telegram:** delivered by default. The author can disable it per
 *   workspace; a user without a linked Telegram account falls back to
 *   in-app only (with a disabled-with-reason chip on the Telegram channel).
 * - **Email:** delivered only when the user has a verified email address.
 *   The spec is explicit that email is *not* a default channel — it is
 *   disabled-with-reason when no verified address exists.
 *
 * A channel failure is reported as **its own** state, never as a failed
 * primary action. A Telegram delivery failure does not fail the in-app
 * notification; the in-app notification is delivered, and the Telegram
 * channel shows a `failed-with-retry` chip.
 *
 * This module is framework-free: it computes channel availability and
 * dispatch state. The server function (`notifications.dispatch.impl.server.ts`)
 * owns the actual send; the React component (`DeliveryStatusChip`) renders
 * the per-channel state.
 */

export const NOTIFICATION_CHANNELS = ['in_app', 'telegram', 'email'] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-app',
  telegram: 'Telegram',
  email: 'Email',
}

export type ChannelAvailability =
  | { readonly kind: 'available' }
  | { readonly kind: 'disabled'; readonly reason: string }
  | { readonly kind: 'unavailable'; readonly reason: string }

export type DeliveryState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'delivered'; readonly at: number }
  | { readonly kind: 'failed'; readonly error: string; readonly retryable: boolean }
  | { readonly kind: 'suppressed'; readonly reason: string }

export interface UserChannelProfile {
  readonly hasTelegram: boolean
  readonly telegramEnabled: boolean
  readonly emailVerified: boolean | null
  readonly email: string | null
}

export interface NotificationIntent {
  readonly template: string
  readonly channels: readonly NotificationChannel[]
  readonly recipient: UserChannelProfile
}

export interface ChannelPlan {
  readonly channel: NotificationChannel
  readonly availability: ChannelAvailability
}

/**
 * Compute the availability of each channel for the given recipient.
 *
 * The spec invariants:
 * - In-app is always available.
 * - Telegram is available iff the recipient has a linked Telegram account
 *   and the workspace has Telegram enabled. Otherwise it is
 *   `disabled-with-reason` (linked account missing) or `unavailable`
 *   (workspace disabled).
 * - Email is available iff the recipient has a verified email address.
 *   No verified address → `disabled-with-reason`. No address at all →
 *   `unavailable`.
 */
export function planChannelDelivery(intent: NotificationIntent): readonly ChannelPlan[] {
  return intent.channels.map((channel): ChannelPlan => {
    if (channel === 'in_app') {
      return { channel, availability: { kind: 'available' } }
    }
    if (channel === 'telegram') {
      if (!intent.recipient.telegramEnabled) {
        return {
          channel,
          availability: { kind: 'unavailable', reason: 'Telegram is disabled for this workspace' },
        }
      }
      if (!intent.recipient.hasTelegram) {
        return {
          channel,
          availability: {
            kind: 'disabled',
            reason: 'No Telegram account linked — in-app notification will be delivered',
          },
        }
      }
      return { channel, availability: { kind: 'available' } }
    }
    // email
    if (!intent.recipient.email) {
      return {
        channel,
        availability: { kind: 'unavailable', reason: 'No email address on file' },
      }
    }
    if (!intent.recipient.emailVerified) {
      return {
        channel,
        availability: {
          kind: 'disabled',
          reason: 'Email address not verified — verify it in Settings to enable email delivery',
        },
      }
    }
    return { channel, availability: { kind: 'available' } }
  })
}

/**
 * Whether a delivery failure on `channel` should be reported as a retryable
 * state. The spec mandates a delivery-failure state with Retry — never a
 * silent failure.
 *
 * A failure is retryable when the channel was available (transient failure:
 * network, provider outage). A failure on a `disabled` or `unavailable`
 * channel is not a failure at all — it is suppressed.
 */
export function isRetryableFailure(
  _channel: NotificationChannel,
  plan: ChannelPlan,
  state: DeliveryState,
): boolean {
  if (state.kind !== 'failed') return false
  if (plan.availability.kind !== 'available') return false
  // All channels are retryable on transient failure — Telegram/email have
  // external providers, in-app is a database write. A `disabled` or
  // `unavailable` channel is suppressed above, never retried.
  return true
}

/**
 * Summarise a multi-channel dispatch for the UI. The spec mandates per-
 * channel reporting — never one success/failure toast for a multi-channel
 * notification.
 */
export interface DispatchSummary {
  readonly delivered: readonly NotificationChannel[]
  readonly failed: readonly { channel: NotificationChannel; error: string; retryable: boolean }[]
  readonly suppressed: readonly { channel: NotificationChannel; reason: string }[]
  readonly pending: readonly NotificationChannel[]
}

export function summarizeDispatch(
  plans: readonly ChannelPlan[],
  states: ReadonlyMap<NotificationChannel, DeliveryState>,
): DispatchSummary {
  const delivered: NotificationChannel[] = []
  const failed: { channel: NotificationChannel; error: string; retryable: boolean }[] = []
  const suppressed: { channel: NotificationChannel; reason: string }[] = []
  const pending: NotificationChannel[] = []

  for (const plan of plans) {
    const state = states.get(plan.channel)
    if (!state) {
      pending.push(plan.channel)
      continue
    }
    if (state.kind === 'delivered') {
      delivered.push(plan.channel)
    } else if (state.kind === 'failed') {
      failed.push({
        channel: plan.channel,
        error: state.error,
        retryable: isRetryableFailure(plan.channel, plan, state),
      })
    } else if (state.kind === 'suppressed') {
      suppressed.push({ channel: plan.channel, reason: state.reason })
    } else {
      pending.push(plan.channel)
    }
  }

  return { delivered, failed, suppressed, pending }
}
