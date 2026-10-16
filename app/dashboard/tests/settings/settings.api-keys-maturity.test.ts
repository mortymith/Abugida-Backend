import { describe, expect, test } from 'bun:test'
import {
  DEAD_LETTER_MAX_RETRIES,
  isDeadLettered,
  isSuperseded,
  isValidWebhookUrl,
  shouldPauseWebhook,
  supersededLabel,
  validateCidr,
  WEBHOOK_PAUSE_THRESHOLD,
} from '#/features/settings/settings.api-keys-maturity'

const NOW = Date.parse('2026-01-15T12:00:00Z')
describe('validateCidr', () => {
  test('valid CIDR', () => {
    const r = validateCidr('197.1.2.0/24')
    expect(r.valid).toBe(true)
    expect(r.normalized).toBe('197.1.2.0/24')
  })
  test('bare IP normalized to /32', () => {
    const r = validateCidr('197.1.2.3')
    expect(r.valid).toBe(true)
    expect(r.normalized).toBe('197.1.2.3/32')
  })
  test('invalid prefix rejected', () => {
    const r = validateCidr('197.1.2.0/33')
    expect(r.valid).toBe(false)
  })
  test('empty rejected', () => {
    expect(validateCidr('').valid).toBe(false)
  })
})
describe('isSuperseded', () => {
  test('true within 24h', () => expect(isSuperseded(NOW - 10 * 60 * 60 * 1000, NOW)).toBe(true))
  test('false after 24h', () => expect(isSuperseded(NOW - 25 * 60 * 60 * 1000, NOW)).toBe(false))
})
describe('supersededLabel', () => {
  test('names remaining hours', () => {
    const label = supersededLabel(NOW - 10 * 60 * 60 * 1000, NOW)
    expect(label).toContain('superseded')
    expect(label).toContain('expires in')
  })
  test('null after 24h', () => {
    expect(supersededLabel(NOW - 25 * 60 * 60 * 1000, NOW)).toBeNull()
  })
})
describe('shouldPauseWebhook', () => {
  test('true at threshold', () => expect(shouldPauseWebhook(WEBHOOK_PAUSE_THRESHOLD)).toBe(true))
  test('false below threshold', () => expect(shouldPauseWebhook(9)).toBe(false))
})
describe('isDeadLettered', () => {
  test('true at max retries', () => expect(isDeadLettered(DEAD_LETTER_MAX_RETRIES)).toBe(true))
  test('false below max', () => expect(isDeadLettered(5)).toBe(false))
})
describe('isValidWebhookUrl', () => {
  test('valid HTTPS', () => expect(isValidWebhookUrl('https://example.com/hook').valid).toBe(true))
  test('rejects HTTP', () => {
    const r = isValidWebhookUrl('http://example.com/hook')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('HTTPS')
  })
  test('rejects invalid URL', () => {
    expect(isValidWebhookUrl('not-a-url').valid).toBe(false)
  })
})
