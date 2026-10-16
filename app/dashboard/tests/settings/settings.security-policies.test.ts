import { describe, expect, test } from 'bun:test'
import {
  canRequireMfa,
  formatAuditTimestamp,
  retentionLabel,
  validateCidrList,
  wouldLockOutSelf,
} from '#/features/settings/settings.security-policies'

describe('validateCidrList', () => {
  test('separates valid and invalid', () => {
    const r = validateCidrList(['10.0.0.0/8', 'invalid', '197.1.2.0/24'])
    expect(r.valid).toHaveLength(2)
    expect(r.invalid).toHaveLength(1)
  })
  test('normalizes bare IPs', () => {
    const r = validateCidrList(['10.0.0.1'])
    expect(r.valid[0]).toBe('10.0.0.1/32')
  })
})
describe('wouldLockOutSelf', () => {
  test('false when IP is in range', () => {
    const r = wouldLockOutSelf(['197.1.2.0/24'], '197.1.2.3')
    expect(r.lockedOut).toBe(false)
  })
  test('true when IP is outside ranges', () => {
    const r = wouldLockOutSelf(['10.0.0.0/8'], '197.1.2.3')
    expect(r.lockedOut).toBe(true)
    expect(r.warning).toContain('197.1.2.3')
  })
  test('false when no ranges', () => {
    expect(wouldLockOutSelf([], '1.2.3.4').lockedOut).toBe(false)
  })
})
describe('canRequireMfa', () => {
  test('blocked with 1 admin', () => {
    const r = canRequireMfa(1)
    expect(r.permitted).toBe(false)
    expect(r.reason).toContain('second admin')
  })
  test('permitted with 2+ admins', () => {
    expect(canRequireMfa(2).permitted).toBe(true)
  })
})
describe('formatAuditTimestamp', () => {
  test('returns ISO-8601 with offset', () => {
    const ts = formatAuditTimestamp(new Date('2026-09-29T09:14:00Z'))
    expect(ts).toContain('2026-09-29')
    expect(ts).toContain('+')
  })
})
describe('retentionLabel', () => {
  test('names 24 months', () => {
    expect(retentionLabel()).toContain('24 months')
  })
})
