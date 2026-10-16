/**
 * Claimable enrollment invite logic (spec 06 § S-4.1 — Add Student no
 * longer collects a name or email; it issues a claimable link or an
 * 8-character code).
 *
 * The spec: "It issues a claimable link (`/enroll/:token`, single-use,
 * 7-day expiry) or an 8-character code. The student's own name is
 * captured after sign-in, from their identity — the inviter never types
 * it."
 *
 * Security: the token and code are stored as SHA-256 hashes (never
 * plaintext) so a database leak does not reveal claimable invites. The
 * plaintext token is returned once at creation time and embedded in the
 * URL; the plaintext code is shown once and copied by the inviter.
 *
 * This module is framework-free: it owns the token/code generation, the
 * hashing, the expiry math, and the claim validation. The server function
 * owns the DB writes.
 */

export const ENROLLMENT_INVITE_EXPIRY_DAYS = 7
export const ENROLLMENT_INVITE_EXPIRY_MS = ENROLLMENT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
export const ENROLLMENT_INVITE_CODE_LENGTH = 8

/**
 * Characters used for the 8-char code. Ambiguous characters (0/O, 1/I/l)
 * are excluded so the code is readable when spoken over the phone or
 * typed from a screenshot.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generate a cryptographically random URL-safe token. 32 bytes (256 bits)
 * base64url-encoded → ~43 characters. Sufficient entropy to prevent
 * brute-force guessing.
 */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

/**
 * Generate an 8-character human-readable code from the unambiguous
 * alphabet. The code is what the inviter copies and shares over Telegram
 * or any channel; the student can type it into the enrollment page.
 */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(ENROLLMENT_INVITE_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < ENROLLMENT_INVITE_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

/**
 * Hash a token or code with SHA-256. Returns a hex string (64 chars).
 * Used for storage — the plaintext is never persisted.
 */
export async function hashInviteSecret(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(hashBuffer)
}

/**
 * Synchronous fallback using Node's `node:crypto` module. Used in server
 * contexts where `crypto.subtle` is async-inconvenient.
 */
export function hashInviteSecretSync(value: string): string {
  const nodeCrypto = require('node:crypto')
  return nodeCrypto.createHash('sha256').update(value).digest('hex')
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build the enrollment URL from a token. The spec: `/enroll/:token`.
 */
export function buildEnrollmentUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/enroll/${token}`
}

/**
 * Compute the expiry timestamp for a new invite. 7 days from `now`.
 */
export function computeInviteExpiry(now: number): Date {
  return new Date(now + ENROLLMENT_INVITE_EXPIRY_MS)
}

/**
 * Whether an invite is expired (past its `expiresAt` and still pending).
 * Claimed/cancelled invites are not "expired" — they have a terminal status.
 */
export function isInviteExpired(status: string, expiresAt: number, now: number): boolean {
  if (status !== 'pending') return false
  return now >= expiresAt
}

/**
 * Whether an invite can be claimed. Must be `pending` and not expired.
 */
export function canClaimInvite(status: string, expiresAt: number, now: number): boolean {
  if (status !== 'pending') return false
  if (now >= expiresAt) return false
  return true
}

/**
 * The success copy shown after creating an invite. The spec: "Enrollment
 * link copied — share it over Telegram or any channel."
 */
export const INVITE_SUCCESS_COPY = 'Enrollment link copied — share it over Telegram or any channel.'

/**
 * The expiry label for the invite card. "Expires in 7 days" / "Expires in
 * 3 days" / "Expires today" / "Expired".
 */
export function inviteExpiryLabel(expiresAt: number, now: number): string {
  const remainingMs = expiresAt - now
  if (remainingMs <= 0) return 'Expired'
  const daysRemaining = Math.floor(remainingMs / (24 * 60 * 60 * 1000))
  if (daysRemaining === 0) return 'Expires today'
  if (daysRemaining === 1) return 'Expires in 1 day'
  return `Expires in ${daysRemaining} days`
}
