import { describe, expect, test } from 'bun:test'
import {
  buildCouponCsv,
  generateCouponCodes,
  MAX_BATCH_SIZE,
  normalizeCouponCode,
  randomCodePart,
} from '#/features/marketing/marketing.coupon-codes'

/**
 * S-8.3 coupon code generation (spec 10): unambiguous alphabet, unique
 * batches with prefixes, normalization to uppercase, and partner CSV export.
 */
describe('coupon codes', () => {
  test('generates the requested number of unique codes', () => {
    const codes = generateCouponCodes(500)
    expect(codes).toHaveLength(500)
    expect(new Set(codes).size).toBe(500)
  })

  test('produces codes from the unambiguous alphabet', () => {
    for (const code of generateCouponCodes(50)) {
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/)
    }
  })

  test('applies and uppercases prefixes', () => {
    const [code] = generateCouponCodes(1, { prefix: 'acme' })
    expect(code).toMatch(/^ACME-/)
  })

  test('rejects batch sizes outside the cap', () => {
    expect(() => generateCouponCodes(0)).toThrow('INVALID_BATCH_SIZE')
    expect(() => generateCouponCodes(MAX_BATCH_SIZE + 1)).toThrow('INVALID_BATCH_SIZE')
  })

  test('deterministic with an injected random source', () => {
    let tick = 0
    const random = () => (tick++ % 29) / 29
    const a = randomCodePart(6, random)
    const b = randomCodePart(6, random)
    expect(a).not.toBe(b)
  })

  test('normalizes codes to trimmed uppercase', () => {
    expect(normalizeCouponCode('  toefl25 ')).toBe('TOEFL25')
  })

  test('builds a code-only CSV by default', () => {
    const csv = buildCouponCsv(['ACME-a3f8k2', 'ACME-k2f8a3'])
    expect(csv).toBe('code\nACME-A3F8K2\nACME-K2F8A3\n')
  })

  test('includes the expiry column when provided', () => {
    const csv = buildCouponCsv(['TOEFL25'], { expiresAt: '2026-10-31' })
    expect(csv).toBe('code,expires_at\nTOEFL25,2026-10-31\n')
  })

  test('rejects unsafe CSV payloads', () => {
    expect(() => buildCouponCsv(['BAD,CODE'])).toThrow('INVALID_CSV_CODE')
  })
})
