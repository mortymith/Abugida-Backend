/**
 * Invite-claim primitives (spec S-0.1 action 3, `11` § Notification Delivery,
 * `13` § GAP-2).
 *
 * A user authenticated by Telegram may have no email address at all, so an
 * invite has to be claimable by something the user can actually receive and
 * retype. Two shapes, one table (`invite_link`):
 *
 *  - a long **token** in a `/invite/:token` link, for delivery over any channel;
 *  - an **8-character code**, for a human reading a message and typing it back.
 *
 * The rules this module owns, all of them security-relevant:
 *
 *  - **Secrets are hashed, never stored.** A database leak must not yield usable
 *    invites, so what lands in the row is a SHA-256 digest. That also means a
 *    claim is a constant-time-shaped lookup on a unique index rather than a
 *    scan, and the raw value is returned exactly once, at issue time.
 *  - **The claim ticket is signed, not stored.** The claim screen runs *before*
 *    sign-in — that is where the code is captured. Rather than burning the
 *    invite on a page the user might abandon, the pre-signin claim proves
 *    nothing more than "this reference is real" and hands back a signed
 *    receipt. The invite is only consumed by the post-signin exchange, where
 *    there is a real user to attach.
 *  - **The code alphabet excludes glyphs that get misread.** No `0/O`, no
 *    `1/I/L` — a code that fails to type is indistinguishable from a dead link
 *    to the person holding it.
 *
 * Pure module: no React, no env, no db. Tested by `tests/auth.invite-claim.test.ts`.
 */

/** Spec S-0.1: the manual code is exactly 8 characters. */
export const CLAIM_CODE_LENGTH = 8

/** Long enough that the link is not guessable; short enough to paste anywhere. */
const TOKEN_BYTES = 32

/**
 * 32 symbols with the visually ambiguous ones removed. `0`/`O` and `1`/`I`/`L`
 * are the pairs that get mistyped from a screenshot or a forwarded message, and
 * a mistyped code is indistinguishable from an invalid one.
 */
export const CLAIM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Spec `11` § Notification Delivery: a claimable invite is single-use, 7-day. */
export const INVITE_LINK_TTL_DAYS = 7

/** The ticket only has to survive the provider redirect round-trip. */
export const CLAIM_TICKET_TTL_SECONDS = 15 * 60

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** A long opaque link token, e.g. `x7Fq…`. Shown once, then only its hash exists. */
export function generateClaimToken(): string {
  return toBase64Url(randomBytes(TOKEN_BYTES))
}

/**
 * The 8-character manual code.
 *
 * Rejection sampling rather than modulo: taking `byte % 32` on a byte that can
 * reach 255 maps 0–31 unevenly and skews the first four symbols of the alphabet.
 * The bias is small, but this is an unguessable credential, so it is done
 * properly.
 */
export function generateClaimCode(): string {
  const alphabet = CLAIM_CODE_ALPHABET
  const limit = 256 - (256 % alphabet.length)
  let out = ''
  while (out.length < CLAIM_CODE_LENGTH) {
    for (const byte of randomBytes(CLAIM_CODE_LENGTH)) {
      if (byte >= limit) continue
      out += alphabet[byte % alphabet.length]
      if (out.length === CLAIM_CODE_LENGTH) break
    }
  }
  return out
}

/** SHA-256, hex. This is what `invite_link.token_hash` / `code_hash` store. */
export async function hashClaimSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret.trim()))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type ClaimReferenceKind = 'token' | 'code'

export interface ClaimReference {
  kind: ClaimReferenceKind
  /** The normalized secret to hash — upper-cased for codes, verbatim for tokens. */
  value: string
}

/**
 * Decide what the user actually typed, or `null` if it is neither shape.
 *
 * A token is a long opaque string; a code is exactly 8 characters from the
 * code alphabet. Anything shorter or with an illegal character is not a
 * reference at all, and the caller answers `not_found` without a lookup — which
 * also means a 3-character paste cannot be used to probe the table.
 */
export function normalizeClaimReference(input: {
  token?: string | null
  code?: string | null
}): ClaimReference | null {
  const raw = (input.token ?? input.code ?? '').trim()
  if (!raw) return null

  const upper = raw.toUpperCase()

  if (upper.length === CLAIM_CODE_LENGTH) {
    for (const char of upper) {
      if (!CLAIM_CODE_ALPHABET.includes(char)) return null
    }
    return { kind: 'code', value: upper }
  }

  // Anything longer is a link token. Rejecting whitespace inside a pasted URL
  // keeps a copy-paste of the whole link (with a trailing `)` or a wrapped
  // line) from hashing to something that simply will not match.
  if (raw.length > CLAIM_CODE_LENGTH && /^[A-Za-z0-9._~+/=-]+$/.test(raw)) {
    return { kind: 'token', value: raw }
  }

  return null
}

/**
 * Whether a value is a well-formed manual code.
 *
 * Exported so the login form's live "is this submittable" check cannot drift
 * from what the server will accept — a second copy of this alphabet in a
 * component is a second thing to get wrong.
 */
export function isClaimCode(value: string): boolean {
  const upper = value.trim().toUpperCase()
  if (upper.length !== CLAIM_CODE_LENGTH) return false
  for (const char of upper) {
    if (!CLAIM_CODE_ALPHABET.includes(char)) return false
  }
  return true
}

/** The code is stored and compared case-insensitively; the token is not. */
export function hashForReference(reference: ClaimReference): Promise<string> {
  return hashClaimSecret(
    reference.kind === 'code' ? reference.value.toUpperCase() : reference.value,
  )
}

export function inviteLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000)
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64Url(new Uint8Array(signature))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Mint the receipt that survives the sign-in redirect.
 *
 * Deliberately *not* a session: it grants nothing on its own. It names an invite
 * and proves the platform issued the claim, so the post-signin exchange can
 * finish the job for a user it can now name.
 */
export async function signClaimTicket(
  inviteLinkId: string,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const expiresAt = Math.floor(now.getTime() / 1000) + CLAIM_TICKET_TTL_SECONDS
  const payload = `${inviteLinkId}.${expiresAt}`
  return `${payload}.${await hmac(payload, secret)}`
}

/** Verify and decode a ticket, or `null` if it is forged, malformed or stale. */
export async function verifyClaimTicket(
  ticket: string,
  secret: string,
  now: Date = new Date(),
): Promise<string | null> {
  const parts = ticket.split('.')
  if (parts.length !== 3) return null

  const [inviteLinkId, expiresAtRaw, signature] = parts
  if (!inviteLinkId || !expiresAtRaw || !signature) return null

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return null
  if (expiresAt * 1000 <= now.getTime()) return null

  const expected = await hmac(`${inviteLinkId}.${expiresAtRaw}`, secret)
  if (!timingSafeEqual(expected, signature)) return null

  return inviteLinkId
}

/**
 * The one message every unusable reference gets.
 *
 * `not_found`, `expired` and `consumed` are deliberately indistinguishable: an
 * invite that was already used must not reveal who used it, and a workspace's
 * invite hygiene is not public information. Spec S-0.1 requires each to read
 * as "ask for a new one", so a single string is the honest implementation.
 */
export function claimFailureMessage(): string {
  return 'This invitation is no longer valid. Ask for a new one — it takes a moment.'
}
