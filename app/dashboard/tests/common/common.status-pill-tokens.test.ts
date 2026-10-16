import { describe, expect, test } from 'bun:test'
import {
  COURSE_STATUS_TO_PILL,
  getStatusPillTokens,
  REVIEW_STATUS_TO_PILL,
  STATUS_PILL_TOKENS,
} from '#/components/common/common.status-pill-tokens'
import type { StatusPillType } from '#/components/common/common.status-pill-tokens'

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
  test('no hardcoded hex', () => {
    for (const t of Object.keys(STATUS_PILL_TOKENS) as StatusPillType[]) {
      const tokens = STATUS_PILL_TOKENS[t]
      expect(tokens.fill).not.toMatch(/^#/)
      expect(tokens.text).not.toMatch(/^#/)
      expect(tokens.tint).not.toMatch(/^#/)
    }
  })
})
describe('COURSE_STATUS_TO_PILL', () => {
  test('published → success', () => expect(COURSE_STATUS_TO_PILL.published).toBe('success'))
  test('draft → neutral', () => expect(COURSE_STATUS_TO_PILL.draft).toBe('neutral'))
  test('archived → archived', () => expect(COURSE_STATUS_TO_PILL.archived).toBe('archived'))
})
describe('REVIEW_STATUS_TO_PILL', () => {
  test('changes_requested → warning', () =>
    expect(REVIEW_STATUS_TO_PILL.changes_requested).toBe('warning'))
  test('approved → success', () => expect(REVIEW_STATUS_TO_PILL.approved).toBe('success'))
})
