/**
 * Notification Delivery contract (spec 10 § S-8.1, spec 11 § Notification
 * Delivery). In-app always, Telegram by default, email only when verified.
 * Underpins S-8.1 campaign multi-channel sends.
 */

export type NotificationChannel = 'in_app' | 'telegram' | 'email'

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

export interface ChannelPlan {
  readonly channel: NotificationChannel
  readonly availability: ChannelAvailability
}

export function planChannelDelivery(
  channels: readonly NotificationChannel[],
  recipient: UserProfile,
): readonly ChannelPlan[] {
  return channels.map((channel): ChannelPlan => {
    if (channel === 'in_app') return { channel, availability: { kind: 'available' } }
    if (channel === 'telegram') {
      if (!recipient.hasTelegram)
        return {
          channel,
          availability: { kind: 'unavailable', reason: 'No Telegram handle linked' },
        }
      if (!recipient.telegramVerified)
        return { channel, availability: { kind: 'disabled', reason: 'Telegram not verified' } }
      return { channel, availability: { kind: 'available' } }
    }
    if (!recipient.email)
      return { channel, availability: { kind: 'unavailable', reason: 'No email address on file' } }
    if (!recipient.emailVerified)
      return { channel, availability: { kind: 'disabled', reason: 'Email not verified' } }
    return { channel, availability: { kind: 'available' } }
  })
}

export function hasNoReachableChannel(plans: readonly ChannelPlan[]): boolean {
  return plans.every((p) => p.availability.kind !== 'available')
}

export interface ChannelBreakdown {
  readonly inApp: number
  readonly telegram: number
  readonly email: number
  readonly noEmail: number
  readonly total: number
}

export function computeChannelBreakdown(recipients: readonly UserProfile[]): ChannelBreakdown {
  let inApp = 0,
    telegram = 0,
    email = 0,
    noEmail = 0
  for (const r of recipients) {
    inApp++
    if (r.hasTelegram && r.telegramVerified) telegram++
    if (r.email && r.emailVerified) email++
    if (!r.email || !r.emailVerified) noEmail++
  }
  return { inApp, telegram, email, noEmail, total: recipients.length }
}

export function formatChannelBreakdown(b: ChannelBreakdown): string {
  return `${b.total} recipients — ${b.inApp} in-app · ${b.telegram} Telegram · ${b.email} email (${b.noEmail} have no email)`
}
