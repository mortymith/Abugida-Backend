import { describe, expect, test } from 'bun:test'
import {
  CLAIM_CODE_ALPHABET,
  CLAIM_CODE_LENGTH,
  claimFailureMessage,
  generateClaimCode,
  generateClaimToken,
  hashClaimSecret,
  hashForReference,
  inviteLinkExpiry,
  INVITE_LINK_TTL_DAYS,
  isClaimCode,
  isExpired,
  normalizeClaimReference,
  signClaimTicket,
  verifyClaimTicket,
} from '#/features/auth/auth.invite-claim'

/**
 * Invite-claim primitives.
 *
 * Two properties are worth more than the rest and get the most attention here:
 *
 *  1. **A mistyped code must fail like a dead link, not like a system error.**
 *     The alphabet drops `0/O` and `1/I/L` precisely because those get misread,
 *     and the normalizer has to agree with what the generator can produce.
 *  2. **The ticket is what stands between a pre-signin claim and a free seat.**
 *     A forged, tampered, or stale ticket must not name an invite, and it must
 *     not be able to be edited to point at a different one.
 */

const SECRET = 'a'.repeat(32)

describe('normalizeClaimReference', () => {
  test('reads an 8-character code from the code alphabet', () => {
    const reference = normalizeClaimReference({ code: '4KD9P2QW' })
    expect(reference).toEqual({ kind: 'code', value: '4KD9P2QW' })
  })

  test('upper-cases a code, since codes are compared case-insensitively', () => {
    expect(normalizeClaimReference({ code: '4kd9p2qw' })).toEqual({
      kind: 'code',
      value: '4KD9P2QW',
    })
  })

  test('reads a long opaque reference as a token', () => {
    const token = generateClaimToken()
    expect(normalizeClaimReference({ token })).toEqual({ kind: 'token', value: token })
  })

  test('trims surrounding whitespace from either shape', () => {
    expect(normalizeClaimReference({ code: '  4KD9P2QW  ' })).toEqual({
      kind: 'code',
      value: '4KD9P2QW',
    })
  })

  test('rejects the glyphs the alphabet deliberately omits', () => {
    // If these ever pass, a user who mistypes O for 0 gets "not found" instead
    // of a clear retry — the exact failure the alphabet exists to prevent.
    for (const code of ['0KD9P2QW', 'OKD9P2QW', '1KD9P2QW', 'IKD9P2QW', 'LKD9P2QW']) {
      expect(normalizeClaimReference({ code })).toBeNull()
    }
  })

  test('rejects an under-length code outright', () => {
    expect(normalizeClaimReference({ code: '4KD9P2Q' })).toBeNull()
  })

  test('an over-length code-shaped string is treated as a token, not a code', () => {
    // Nine characters is genuinely ambiguous with a short link token, and the
    // login screen makes the same call (over 8 characters is a token). Hashing it
    // as a token means the lookup simply misses and the user gets the one
    // "not valid" message — which is right. Guessing that they *meant* a code
    // would turn a typo into a silent no-op.
    expect(normalizeClaimReference({ code: '4KD9P2QWW' })).toEqual({
      kind: 'token',
      value: '4KD9P2QWW',
    })
  })

  test('rejects an empty reference', () => {
    expect(normalizeClaimReference({})).toBeNull()
    expect(normalizeClaimReference({ token: '   ' })).toBeNull()
  })

  test('rejects a pasted URL with characters a token cannot contain', () => {
    // Copying the whole line out of a message is the normal way this arrives.
    expect(normalizeClaimReference({ token: 'https://x.example/invite/abc' })).toBeNull()
  })

  test('prefers the token when both are supplied', () => {
    const token = generateClaimToken()
    expect(normalizeClaimReference({ token, code: '4KD9P2QW' })).toEqual({
      kind: 'token',
      value: token,
    })
  })
})

describe('generateClaimCode', () => {
  test('is the length the spec prints, and every character is typeable', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateClaimCode()
      expect(code).toHaveLength(CLAIM_CODE_LENGTH)
      for (const char of code) expect(CLAIM_CODE_ALPHABET).toContain(char)
    }
  })

  test('produces a code the normalizer accepts — the two must agree', () => {
    // The generator and the normalizer are the only two things that know the
    // alphabet. If they ever disagree, every code issued fails to claim.
    for (let i = 0; i < 200; i += 1) {
      expect(normalizeClaimReference({ code: generateClaimCode() })).not.toBeNull()
    }
  })

  test('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateClaimCode()))
    expect(seen.size).toBe(200)
  })
})

describe('isClaimCode', () => {
  test('accepts a well-formed code in either case, with whitespace', () => {
    expect(isClaimCode('4KD9P2QW')).toBe(true)
    expect(isClaimCode('4kd9p2qw')).toBe(true)
    expect(isClaimCode('  4KD9P2QW  ')).toBe(true)
  })

  test('rejects the ambiguous glyphs and the wrong length', () => {
    for (const bad of ['0KD9P2QW', 'OKD9P2QW', '1KD9P2QW', 'IKD9P2QW', 'LKD9P2QW', '4KD9P2Q', '']) {
      expect(isClaimCode(bad)).toBe(false)
    }
  })

  test('agrees with generateClaimCode and with the normalizer', () => {
    // The login button's live enabled state, the generator and the server's
    // normalizer all read the same alphabet. If these disagree, the user gets a
    // live button that the server refuses.
    for (let i = 0; i < 100; i += 1) {
      const code = generateClaimCode()
      expect(isClaimCode(code)).toBe(true)
      expect(normalizeClaimReference({ code })?.kind).toBe('code')
    }
  })
})

describe('generateClaimToken', () => {
  test('is URL-safe and long enough not to be guessable', () => {
    const token = generateClaimToken()
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateClaimToken()))
    expect(seen.size).toBe(200)
  })
})

describe('hashClaimSecret', () => {
  test('is stable, so a claim finds the row it issued', async () => {
    const a = await hashClaimSecret('4KD9P2QW')
    const b = await hashClaimSecret('4KD9P2QW')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  test('never returns the secret itself', async () => {
    const secret = generateClaimToken()
    expect(await hashClaimSecret(secret)).not.toContain(secret)
  })

  test('hashes a code the same way through either entry point', async () => {
    // A user who types the code in lower case must claim the invite issued for
    // the upper-cased one.
    const upper = normalizeClaimReference({ code: '4KD9P2QW' })
    const lower = normalizeClaimReference({ code: '4kd9p2qw' })
    expect(await hashForReference(upper!)).toBe(await hashForReference(lower!))
  })

  test('distinguishes different secrets', async () => {
    expect(await hashClaimSecret('4KD9P2QW')).not.toBe(await hashClaimSecret('4KD9P2QX'))
  })
})

describe('expiry', () => {
  test('a claimable invite lives for the seven days the spec states', () => {
    const now = new Date('2026-10-01T00:00:00.000Z')
    const expiry = inviteLinkExpiry(now)
    const days = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBe(INVITE_LINK_TTL_DAYS)
  })

  test('isExpired is true at the boundary, not only after it', () => {
    const now = new Date('2026-10-01T00:00:00.000Z')
    expect(isExpired(now, now)).toBe(true)
    expect(isExpired(new Date(now.getTime() + 1), now)).toBe(false)
  })
})

describe('claim ticket', () => {
  test('round-trips the invite it was minted for', async () => {
    const ticket = await signClaimTicket('inv_123', SECRET)
    expect(await verifyClaimTicket(ticket, SECRET)).toBe('inv_123')
  })

  test('rejects a ticket signed with a different secret', async () => {
    const ticket = await signClaimTicket('inv_123', SECRET)
    expect(await verifyClaimTicket(ticket, 'b'.repeat(32))).toBeNull()
  })

  test('rejects a ticket edited to name a different invite', async () => {
    // The signature covers the id, so swapping it must invalidate the ticket
    // rather than silently re-point it at someone else's seat.
    const ticket = await signClaimTicket('inv_123', SECRET)
    const [, expiresAt, signature] = ticket.split('.')
    const forged = `inv_999.${expiresAt}.${signature}`
    expect(await verifyClaimTicket(forged, SECRET)).toBeNull()
  })

  test('rejects a ticket with a forged signature', async () => {
    const ticket = await signClaimTicket('inv_123', SECRET)
    const [id, expiresAt] = ticket.split('.')
    expect(await verifyClaimTicket(`${id}.${expiresAt}.${'A'.repeat(43)}`, SECRET)).toBeNull()
  })

  test('rejects an expiry edited into the future', async () => {
    const ticket = await signClaimTicket('inv_123', SECRET)
    const [id, , signature] = ticket.split('.')
    const far = Math.floor(Date.now() / 1000) + 86_400
    expect(await verifyClaimTicket(`${id}.${far}.${signature}`, SECRET)).toBeNull()
  })

  test('rejects a stale ticket', async () => {
    const issued = new Date(Date.now() - 60 * 60 * 1000)
    const ticket = await signClaimTicket('inv_123', SECRET, issued)
    expect(await verifyClaimTicket(ticket, SECRET)).toBeNull()
  })

  test('rejects structurally malformed input without throwing', async () => {
    for (const bad of ['', 'nope', 'a.b', 'a.b.c.d', 'inv.abc.sig']) {
      expect(await verifyClaimTicket(bad, SECRET)).toBeNull()
    }
  })
})

describe('claimFailureMessage', () => {
  test('is one message, so no invalid state reveals who consumed an invite', () => {
    // Spec S-0.1: not found, expired and consumed must read identically. The
    // copy names the next action and nothing about the invite's history.
    const message = claimFailureMessage()
    expect(message).toBe(
      'This invitation is no longer valid. Ask for a new one — it takes a moment.',
    )
    expect(message).toContain('Ask for a new one')
  })
})
