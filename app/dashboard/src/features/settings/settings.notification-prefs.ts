/**
 * S-6.1 Notification preferences logic (spec 08 § S-6.1). Tri-state per
 * type, digest, quiet hours, email-disabled-with-reason.
 */

export type NotificationType =
  | 'review_assigned'
  | 'review_decided'
  | 'course_published'
  | 'new_enrollment'
  | 'student_question'
  | 'payment_failed'
  | 'retention_warning'
  | 'webhook_delivery_failed'

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  review_assigned: 'Review assigned',
  review_decided: 'Review decided',
  course_published: 'Course published',
  new_enrollment: 'New enrollment',
  student_question: 'Student question',
  payment_failed: 'Payment failed',
  retention_warning: 'Retention warning',
  webhook_delivery_failed: 'Webhook delivery failed',
}

/** Critical alerts that are never suppressible by quiet hours. */
export const CRITICAL_ALERTS: ReadonlySet<NotificationType> = new Set([
  'payment_failed',
  'retention_warning',
])

export type ChannelToggle = 'on' | 'off'

export interface NotificationPreferences {
  readonly channels: {
    readonly inApp: ChannelToggle // always 'on' — not user-disableable
    readonly telegram: ChannelToggle
    readonly email: ChannelToggle
  }
  readonly perType: Readonly<
    Record<NotificationType, { inApp: boolean; telegram: boolean; email: boolean }>
  >
  readonly digest: 'off' | 'daily' | 'weekly'
  readonly digestTime: string // "08:00"
  readonly quietHoursStart: string // "22:00"
  readonly quietHoursEnd: string // "07:00"
}

export const DEFAULT_QUIET_HOURS_START = '22:00'
export const DEFAULT_QUIET_HOURS_END = '07:00'

/**
 * Whether a notification type should be suppressed by quiet hours.
 * Critical alerts (payment.failed, security.*) are never suppressible.
 */
export function isSuppressedByQuietHours(
  type: NotificationType,
  currentTime: string,
  prefs: NotificationPreferences,
): boolean {
  if (CRITICAL_ALERTS.has(type)) return false
  const { quietHoursStart, quietHoursEnd } = prefs
  // Handle overnight window (e.g., 22:00 – 07:00)
  if (quietHoursStart <= quietHoursEnd) {
    return currentTime >= quietHoursStart && currentTime < quietHoursEnd
  }
  // Overnight: suppress if after start OR before end
  return currentTime >= quietHoursStart || currentTime < quietHoursEnd
}

/**
 * Whether the email channel toggle should be disabled with a reason.
 */
export function shouldDisableEmailToggle(emailVerified: boolean): {
  disabled: boolean
  reason: string | null
} {
  if (!emailVerified) {
    return { disabled: true, reason: 'No verified email on this account' }
  }
  return { disabled: false, reason: null }
}

/**
 * The quiet-hours label with "Critical alerts always come through".
 */
export function quietHoursLabel(prefs: NotificationPreferences): string {
  return `Quiet hours: ${prefs.quietHoursStart} – ${prefs.quietHoursEnd}. Critical alerts always come through.`
}

/**
 * Whether the digest is active and what its next evaluation time is.
 */
export function digestNextEvaluation(
  prefs: NotificationPreferences,
  userTimezone: string,
): string | null {
  if (prefs.digest === 'off') return null
  return `${prefs.digest === 'daily' ? 'Daily' : 'Weekly Mon'} ${prefs.digestTime} (${userTimezone})`
}
