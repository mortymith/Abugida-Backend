import { describe, expect, test } from 'bun:test'
import type { StatusPillType } from '#/components/common/common.status-pill-tokens'
import {
  getStatusPillLabel,
  getStatusPillTokens,
  STATUS_PILL_TOKENS,
} from '#/components/common/common.status-pill-tokens'

describe('STATUS_PILL_TOKENS', () => {
  test('7 types with fill/text/tint triples', () => {
    const types: StatusPillType[] = [
      'success',
      'info',
      'warning',
      'danger',
      'neutral',
      'archived',
      'ai',
    ]
    for (const t of types) {
      const tokens = getStatusPillTokens(t)
      expect(tokens.fill).toMatch(/^--color-/)
      expect(tokens.text).toMatch(/^--color-/)
      expect(tokens.tint).toMatch(/^--color-/)
    }
  })
  test('no hardcoded hex values', () => {
    for (const t of Object.keys(STATUS_PILL_TOKENS) as StatusPillType[]) {
      const tokens = STATUS_PILL_TOKENS[t]
      expect(tokens.fill).not.toMatch(/^#/)
      expect(tokens.text).not.toMatch(/^#/)
      expect(tokens.tint).not.toMatch(/^#/)
    }
  })
})
describe('getStatusPillLabel', () => {
  test('returns label for each type', () => {
    expect(getStatusPillLabel('success')).toBe('Success')
    expect(getStatusPillLabel('danger')).toBe('Danger')
  })
})
