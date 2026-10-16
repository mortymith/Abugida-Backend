/**
 * Telegram-first directory logic (spec 06 § S-4.1 Rev 3).
 *
 * The spec: "The directory keyed on `Email`, the profile showed an address
 * as the primary contact, and Add Student collected name + email. Auth is
 * Google + Telegram only, so a Telegram user may have **no address at all**.
 * The `Email` column is replaced by **`Telegram`**, email becomes a
 * secondary column rendering `—` when absent, and each contact channel
 * carries a **verified** marker."
 *
 * This module owns:
 * 1. The contact-channel availability model (which channels a student has).
 * 2. The "No linked contact" badge logic.
 * 3. The "Send enrollment link" row-action gating.
 * 4. The verified-marker display logic.
 */

export type ContactChannel = 'telegram' | 'email' | 'phone'

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  telegram: 'Telegram',
  email: 'Email',
  phone: 'Phone',
}

export interface StudentContactInfo {
  readonly telegramHandle: string | null
  readonly telegramVerified: boolean
  readonly email: string | null
  readonly emailVerified: boolean
  readonly phoneLast4: string | null
}

export type ContactAvailability =
  | { readonly kind: 'available'; readonly channel: ContactChannel; readonly verified: boolean }
  | { readonly kind: 'unavailable'; readonly channel: ContactChannel; readonly reason: string }

/**
 * Compute the availability of each contact channel for a student. The
 * spec: "each contact channel carries a verified marker." A channel with
 * no value is `unavailable`; a channel with a value but unverified is
 * `available` with `verified: false`.
 */
export function computeContactAvailability(
  info: StudentContactInfo,
): readonly ContactAvailability[] {
  const channels: ContactAvailability[] = []

  if (info.telegramHandle) {
    channels.push({
      kind: 'available',
      channel: 'telegram',
      verified: info.telegramVerified,
    })
  } else {
    channels.push({
      kind: 'unavailable',
      channel: 'telegram',
      reason: 'No Telegram handle linked',
    })
  }

  if (info.email) {
    channels.push({
      kind: 'available',
      channel: 'email',
      verified: info.emailVerified,
    })
  } else {
    channels.push({
      kind: 'unavailable',
      channel: 'email',
      reason: 'No email address on file',
    })
  }

  if (info.phoneLast4) {
    channels.push({
      kind: 'available',
      channel: 'phone',
      verified: true, // phone is always verified (Better Auth enforces)
    })
  } else {
    channels.push({
      kind: 'unavailable',
      channel: 'phone',
      reason: 'No phone number on file',
    })
  }

  return channels
}

/**
 * Whether a student has ANY verified contact channel. The spec: a student
 * with no address is never silently skipped — the directory shows a "No
 * linked contact" badge and the row action becomes "Send enrollment link".
 */
export function hasVerifiedContact(info: StudentContactInfo): boolean {
  return (
    (info.telegramHandle !== null && info.telegramVerified) ||
    (info.email !== null && info.emailVerified) ||
    info.phoneLast4 !== null
  )
}

/**
 * Whether a student has ANY contact channel at all (verified or not).
 * Used to decide whether to show the "No linked contact" badge.
 */
export function hasAnyContact(info: StudentContactInfo): boolean {
  return info.telegramHandle !== null || info.email !== null || info.phoneLast4 !== null
}

/**
 * The primary contact channel for directory display. Telegram-first per
 * spec Rev 3: if the student has a Telegram handle, that's primary;
 * email is secondary; phone is tertiary.
 */
export function primaryContactChannel(info: StudentContactInfo): {
  channel: ContactChannel | null
  value: string | null
  verified: boolean
} {
  if (info.telegramHandle) {
    return {
      channel: 'telegram',
      value: info.telegramHandle,
      verified: info.telegramVerified,
    }
  }
  if (info.email) {
    return { channel: 'email', value: info.email, verified: info.emailVerified }
  }
  if (info.phoneLast4) {
    return { channel: 'phone', value: `•••${info.phoneLast4}`, verified: true }
  }
  return { channel: null, value: null, verified: false }
}

/**
 * The secondary contact value for the directory's secondary column.
 * Renders `—` when absent (spec: "email becomes a secondary column
 * rendering `—` when absent").
 */
export function secondaryContactValue(info: StudentContactInfo): string {
  if (info.email) return info.email
  if (info.phoneLast4) return `•••${info.phoneLast4}`
  return '—'
}

/**
 * Whether the "Send enrollment link" row action should be shown. The
 * spec: shown for students with no verified contact (the only thing that
 * actually helps is a claimable link).
 */
export function shouldShowSendEnrollmentLink(info: StudentContactInfo): boolean {
  return !hasVerifiedContact(info)
}

/**
 * The "No linked contact" badge label. The spec: a student with no
 * address is never silently skipped.
 */
export function noContactBadgeLabel(info: StudentContactInfo): string | null {
  if (hasAnyContact(info)) return null
  return 'No linked contact'
}

/**
 * The verified marker for a channel. The spec: "each contact channel
 * carries a verified marker." Returns `✔` for verified, `—` for
 * unverified, `null` for unavailable.
 */
export function verifiedMarker(availability: ContactAvailability): string | null {
  if (availability.kind === 'unavailable') return null
  return availability.verified ? '✔' : '—'
}
