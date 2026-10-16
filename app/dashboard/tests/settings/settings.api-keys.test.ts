import { describe, expect, test } from 'bun:test'
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  maskKey,
  signWebhookPayload,
} from '#/features/settings/settings.api-keys'
import { addDays, isSlaWarning, slaDeadline, slaDaysLeft } from '#/features/settings/settings.sla'

describe('api key generation', () => {
  test('keys use the sk_live prefix and url-safe alphabet', () => {
    const { key, prefix, last4 } = generateApiKey()
    expect(key.startsWith(`${prefix}_`)).toBe(true)
    expect(key).toMatch(/^sk_live_[A-Za-z0-9_-]+$/)
    expect(last4).toBe(key.slice(-4))
    expect(key.length).toBeGreaterThan(30)
  })

  test('two keys never collide (512-bit randomness)', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).not.toBe(b.key)
  })

  test('masking shows only the tail', () => {
    expect(maskKey('sk_live', '3f2a')).toBe('sk_live_••••3f2a')
  })
})

describe('api key hashing', () => {
  test('hash is deterministic and differs from the plaintext', async () => {
    const { key } = generateApiKey()
    const hash1 = await hashApiKey(key)
    const hash2 = await hashApiKey(key)
    expect(hash1).toBe(hash2)
    expect(hash1).not.toContain(key)
    expect(hash1).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test('different keys hash differently', async () => {
    const a = await hashApiKey(generateApiKey().key)
    const b = await hashApiKey(generateApiKey().key)
    expect(a).not.toBe(b)
  })
})

describe('webhook signing', () => {
  test('HMAC-SHA256 signature is deterministic per (secret, payload, timestamp)', async () => {
    const secret = generateWebhookSecret()
    expect(secret.startsWith('whsec_')).toBe(true)
    const sig1 = await signWebhookPayload(secret, '{"a":1}', 1_700_000_000)
    const sig2 = await signWebhookPayload(secret, '{"a":1}', 1_700_000_000)
    expect(sig1).toBe(sig2)
    expect(sig1).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test('a different timestamp or payload changes the signature', async () => {
    const secret = generateWebhookSecret()
    const base = await signWebhookPayload(secret, 'payload', 1_700_000_000)
    expect(await signWebhookPayload(secret, 'payload', 1_700_000_001)).not.toBe(base)
    expect(await signWebhookPayload(secret, 'tampered', 1_700_000_000)).not.toBe(base)
  })
})

describe('sla math (30-day statutory deadline)', () => {
  const requestedAt = new Date('2026-09-01T12:00:00.000Z')

  test('deadline is exactly 30 days later', () => {
    expect(slaDeadline(requestedAt).toISOString()).toBe('2026-10-01T12:00:00.000Z')
  })

  test('days left floors whole days', () => {
    // 28.5 days left → 28
    expect(slaDaysLeft(requestedAt, new Date('2026-09-03T00:00:00.000Z'))).toBe(28)
    // deadline minus 12 hours → 0 (same calendar-day window)
    expect(slaDaysLeft(requestedAt, new Date('2026-10-01T00:00:00.000Z'))).toBe(0)
    // overdue → negative
    expect(slaDaysLeft(requestedAt, new Date('2026-10-05T00:00:00.000Z'))).toBe(-4)
  })

  test('warning badge triggers within the final 5 days and when overdue', () => {
    expect(isSlaWarning(requestedAt, new Date('2026-09-20T00:00:00.000Z'))).toBe(false)
    expect(isSlaWarning(requestedAt, new Date('2026-09-27T00:00:00.000Z'))).toBe(true)
    expect(isSlaWarning(requestedAt, new Date('2026-10-10T00:00:00.000Z'))).toBe(true)
  })

  test('addDays crosses month boundaries', () => {
    expect(addDays(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    )
  })
})
