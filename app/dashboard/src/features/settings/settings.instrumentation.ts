/**
 * Settings instrumentation event vocabulary (spec 08 § Instrumentation &
 * acceptance).
 * No PII: no names, no emails, no handles, no secrets in any payload.
 */

export const SETTINGS_INSTRUMENTATION_EVENTS = [
  'settings_general_saved',
  'settings_notification_pref_changed',
  'settings_discard_confirmed',
  'team_invite_created',
  'team_invite_accepted',
  'team_role_changed',
  'team_member_removed',
  'billing_plan_changed',
  'billing_payment_method_added',
  'billing_invoice_downloaded',
  'security_policy_changed',
  'security_ip_lockout_blocked',
  'security_recovery_requested',
  'audit_exported',
  'roles_capability_changed',
  'roles_custom_created',
  'roles_save_blocked',
  'retention_policy_updated',
  'retention_previewed',
  'retention_executed',
  'privacy_export_downloaded',
  'privacy_erase_completed',
  'danger_transfer_requested',
  'danger_transfer_accepted',
  'danger_export_requested',
  'danger_deletion_scheduled',
  'danger_restored',
  'danger_purged',
  'branding_updated',
  'webhook_tested',
  'api_key_rotated',
] as const

export type SettingsInstrumentationEvent = (typeof SETTINGS_INSTRUMENTATION_EVENTS)[number]

export interface SettingsInstrumentationPayload {
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
  'apiKey',
  'webhookUrl',
])

export function validateSettingsPayload(payload: SettingsInstrumentationPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string' || payload.id.length === 0)
    return 'Settings instrumentation payload must have a non-empty string `id`'
  for (const key of Object.keys(payload))
    if (FORBIDDEN_KEYS.has(key))
      return `Settings instrumentation payload must not include key "${key}" (PII or secret leak)`
  if (payload.count !== undefined && typeof payload.count !== 'number')
    return 'Settings instrumentation payload `count` must be a number'
  return null
}

export function trackSettingsEvent(
  event: SettingsInstrumentationEvent,
  payload: SettingsInstrumentationPayload,
  send: (event: string, payload: SettingsInstrumentationPayload) => void,
): void {
  const error = validateSettingsPayload(payload)
  if (error !== null) {
    console.warn(`[settings-instrumentation] ${event}: ${error}`)
    return
  }
  send(event, payload)
}
