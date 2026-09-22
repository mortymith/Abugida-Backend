import { describe, expect, test } from 'bun:test'
import {
  assertTransition,
  canTransition,
  describeAudience,
  isDuplicatable,
  isEditable,
  isMetricsUpdating,
  LARGE_SEND_THRESHOLD,
  requiresLargeSendConfirmation,
} from '#/features/marketing/marketing.campaign-states'

/**
 * S-8.1 campaign lifecycle (spec 10): draft → scheduled/sending → sent,
 * cancel only before firing, duplicate settled rows, large-send threshold,
 * and the first-hour metrics-updating window.
 */
describe('campaign state machine', () => {
  test('draft can be scheduled or sent now', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true)
    expect(canTransition('draft', 'sending')).toBe(true)
  })

  test('scheduled can fire or be cancelled', () => {
    expect(canTransition('scheduled', 'sending')).toBe(true)
    expect(canTransition('scheduled', 'cancelled')).toBe(true)
  })

  test('sending settles to sent', () => {
    expect(canTransition('sending', 'sent')).toBe(true)
  })

  test('terminal states cannot transition', () => {
    expect(canTransition('sent', 'draft')).toBe(false)
    expect(canTransition('cancelled', 'scheduled')).toBe(false)
    expect(canTransition('sent', 'cancelled')).toBe(false)
  })

  test('arbitrary client-side jumps are rejected', () => {
    expect(canTransition('draft', 'sent')).toBe(false)
    expect(canTransition('draft', 'cancelled')).toBe(false)
    expect(() => assertTransition('cancelled', 'sending')).toThrow('INVALID_CAMPAIGN_STATE')
  })

  test('editing is allowed pre-send only', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('scheduled')).toBe(true)
    expect(isEditable('sending')).toBe(false)
    expect(isEditable('sent')).toBe(false)
  })

  test('duplication is allowed for settled rows', () => {
    expect(isDuplicatable('draft')).toBe(true)
    expect(isDuplicatable('sent')).toBe(true)
    expect(isDuplicatable('cancelled')).toBe(true)
    expect(isDuplicatable('sending')).toBe(false)
  })

  test('large sends require confirmation above the threshold', () => {
    expect(requiresLargeSendConfirmation(LARGE_SEND_THRESHOLD)).toBe(false)
    expect(requiresLargeSendConfirmation(LARGE_SEND_THRESHOLD + 1)).toBe(true)
  })

  test('metrics show as updating for the first hour after send', () => {
    const sentAt = '2026-03-15T10:00:00.000Z'
    expect(isMetricsUpdating(sentAt, new Date('2026-03-15T10:59:00.000Z'))).toBe(true)
    expect(isMetricsUpdating(sentAt, new Date('2026-03-15T11:01:00.000Z'))).toBe(false)
    expect(isMetricsUpdating(null, new Date())).toBe(false)
  })
})

describe('audience description', () => {
  test('empty segment reads as all contacts', () => {
    expect(
      describeAudience({ cohortPublicIds: [], coursePublicIds: [], tags: [], activity: 'any' }),
    ).toBe('All contacts')
  })

  test('describes filters in a readable label', () => {
    expect(
      describeAudience({
        cohortPublicIds: ['a', 'b'],
        coursePublicIds: [],
        tags: ['toefl-jan'],
        activity: 'active_30d',
      }),
    ).toBe('2 cohorts · tags: toefl-jan · Active in last 30 days')
  })

  test('pluralizes a single course correctly', () => {
    expect(
      describeAudience({
        cohortPublicIds: [],
        coursePublicIds: ['x'],
        tags: [],
        activity: 'any',
      }),
    ).toBe('1 course')
  })
})
