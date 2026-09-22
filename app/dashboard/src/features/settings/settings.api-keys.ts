/**
 * Pure API-key and webhook-signing helpers for S-6.7 (API & Webhooks).
 * Uses WebCrypto (available in Bun and browsers) — no Node-specific APIs.
 *
 * Key shape: `sk_live_<32 url-safe chars>`. Only the SHA-256 hash is stored;
 * the plaintext is returned to the admin exactly once at creation.
 */

export const API_KEY_PREFIX = 'sk_live'
const KEY_RANDOM_BYTES = 32

function toUrlSafe(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateApiKey(): { key: string; prefix: string; last4: string } {
  const bytes = new Uint8Array(KEY_RANDOM_BYTES)
  crypto.getRandomValues(bytes)
  const random = toUrlSafe(bytes)
  return {
    key: `${API_KEY_PREFIX}_${random}`,
    prefix: API_KEY_PREFIX,
    last4: random.slice(-4),
  }
}

/** Spec S-6.7 masked form: `sk_live_••••3f2a`. */
export function maskKey(prefix: string, last4: string): string {
  return `${prefix}_••••${last4}`
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return toUrlSafe(new Uint8Array(digest))
}

/**
 * Outbound webhook signing (S-6.7 Send Test Event). Payloads are signed with
 * HMAC-SHA256 so receivers can verify authenticity; the secret never leaves
 * the server.
 */
export async function signWebhookPayload(
  secret: string,
  payload: string,
  timestamp: number,
): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(`${timestamp}.${payload}`),
  )
  return toUrlSafe(new Uint8Array(signature))
}

/** Generate a webhook signing secret (`whsec_…`). */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `whsec_${toUrlSafe(bytes)}`
}
