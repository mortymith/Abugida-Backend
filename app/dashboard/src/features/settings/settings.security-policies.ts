/**
 * S-6.8 Security policies logic (spec 08 § S-6.8). IP allow-list
 * self-lockout check, MFA enforcement guard, audit-log formatting.
 */

import { validateCidr } from './settings.api-keys-maturity'

export const SESSION_TIMEOUT_OPTIONS = ['15m', '1h', '8h', '24h', '7d'] as const
export type SessionTimeout = (typeof SESSION_TIMEOUT_OPTIONS)[number]

export const AUDIT_LOG_RETENTION_MONTHS = 24
export const AUDIT_LOG_PAGE_SIZE = 50

/**
 * Validate a list of CIDR ranges. Returns per-range validation results.
 */
export function validateCidrList(ranges: readonly string[]): {
  valid: string[]
  invalid: { range: string; error: string }[]
} {
  const valid: string[] = []
  const invalid: { range: string; error: string }[] = []
  for (const range of ranges) {
    const result = validateCidr(range)
    if (result.valid && result.normalized) {
      valid.push(result.normalized)
    } else {
      invalid.push({ range, error: result.error ?? 'Invalid CIDR' })
    }
  }
  return { valid, invalid }
}

/**
 * Check whether the actor's current IP is within the allow-listed ranges.
 * The spec: "A live count of ranges sits under the field. A self-lockout
 * check runs against the acting user's current address on every keystroke."
 */
export function wouldLockOutSelf(
  ranges: readonly string[],
  currentIp: string,
): { lockedOut: boolean; warning: string | null } {
  if (ranges.length === 0) return { lockedOut: false, warning: null }

  const { valid } = validateCidrList(ranges)
  for (const range of valid) {
    if (isIpInCidr(currentIp, range)) {
      return { lockedOut: false, warning: null }
    }
  }
  return {
    lockedOut: true,
    warning: `Your current address ${currentIp} is outside these ranges — you will lock yourself out on save.`,
  }
}

/**
 * Check if an IP is within a CIDR range (IPv4 only).
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  if (!rangeIp || Number.isNaN(prefix)) return false

  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(rangeIp)
  if (ipInt === null || rangeInt === null) return false

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => parseInt(p, 10))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0
}

/**
 * Whether "Require MFA for all admins" can be enabled. Blocked when the
 * workspace has exactly one Admin.
 */
export function canRequireMfa(adminCount: number): { permitted: boolean; reason: string | null } {
  if (adminCount <= 1) {
    return {
      permitted: false,
      reason: 'Add a second admin first — otherwise a lost authenticator locks the workspace.',
    }
  }
  return { permitted: true, reason: null }
}

/**
 * Format an audit-log timestamp as ISO-8601 with offset. The spec:
 * "the audit log renders absolute ISO-8601 with offset — never 'today'
 * or 'Yesterday'."
 */
export function formatAuditTimestamp(date: Date): string {
  return date.toISOString().replace('Z', '+00:00')
}

/**
 * The audit-log retention label. "Retained 24 months"
 */
export function retentionLabel(): string {
  return `Retained ${AUDIT_LOG_RETENTION_MONTHS} months`
}
