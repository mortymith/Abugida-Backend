/**
 * S-6.7 API key CIDR + rotate logic (spec 08 § S-6.7). CIDR validation,
 * 24-hour rotate overlap, webhook pause/dead-letter.
 */

export const ROTATE_OVERLAP_HOURS = 24
export const ROTATE_OVERLAP_MS = ROTATE_OVERLAP_HOURS * 60 * 60 * 1000
export const WEBHOOK_PAUSE_THRESHOLD = 10 // consecutive failures before pause

/**
 * Validate a CIDR range. Accepts both IPv4 CIDR (e.g., 197.1.2.0/24) and
 * bare IPs (normalized to /32). Returns the normalized form or an error.
 */
export function validateCidr(input: string): {
  valid: boolean
  normalized: string | null
  error: string | null
} {
  const trimmed = input.trim()
  if (trimmed === '') return { valid: false, normalized: null, error: 'CIDR range is required' }

  // CIDR notation
  const cidrMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (cidrMatch) {
    const [, ip, prefix] = cidrMatch
    const prefixNum = parseInt(prefix, 10)
    if (prefixNum < 0 || prefixNum > 32) {
      return { valid: false, normalized: null, error: `Invalid prefix /${prefix} — must be 0–32` }
    }
    if (!isValidIp(ip)) {
      return { valid: false, normalized: null, error: `Invalid IP address: ${ip}` }
    }
    return { valid: true, normalized: trimmed, error: null }
  }

  // Bare IP — normalize to /32
  if (isValidIp(trimmed)) {
    return { valid: true, normalized: `${trimmed}/32`, error: null }
  }

  return {
    valid: false,
    normalized: null,
    error: `"${trimmed}" is not a valid CIDR range or IP address`,
  }
}

function isValidIp(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = parseInt(p, 10)
    return !Number.isNaN(n) && n >= 0 && n <= 255
  })
}

/**
 * Whether a rotated key is in the superseded overlap window.
 */
export function isSuperseded(rotatedAt: number, now: number): boolean {
  return now - rotatedAt < ROTATE_OVERLAP_MS
}

/**
 * The superseded key label. "superseded — expires in 24h"
 */
export function supersededLabel(rotatedAt: number, now: number): string | null {
  if (!isSuperseded(rotatedAt, now)) return null
  const remainingMs = ROTATE_OVERLAP_MS - (now - rotatedAt)
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000))
  return `superseded — expires in ${remainingHours}h`
}

/**
 * Whether a webhook should be auto-paused after consecutive failures.
 */
export function shouldPauseWebhook(consecutiveFailures: number): boolean {
  return consecutiveFailures >= WEBHOOK_PAUSE_THRESHOLD
}

/**
 * Whether a delivery is dead-lettered (exceeded max retries).
 */
export const DEAD_LETTER_MAX_RETRIES = 10

export function isDeadLettered(retryCount: number): boolean {
  return retryCount >= DEAD_LETTER_MAX_RETRIES
}

/**
 * Whether an endpoint URL is valid (HTTPS only).
 */
export function isValidWebhookUrl(url: string): { valid: boolean; error: string | null } {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Endpoint URLs must be HTTPS' }
    }
    return { valid: true, error: null }
  } catch {
    return { valid: false, error: 'Invalid URL' }
  }
}
