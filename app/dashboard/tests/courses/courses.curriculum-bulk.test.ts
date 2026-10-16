import { describe, expect, test } from 'bun:test'
import {
  BULK_SELECTION_CAP,
  computePurgeCountdown,
  computeSelectAllState,
  hasMixedResults,
  isSelectionCapped,
  itemsEligibleForPurge,
  purgeCountdownLabel,
  selectAllLabel,
  SOFT_DELETE_RETENTION_MS,
  summarizeBulkAction,
  toggleItemSelection,
  toggleSelectAll,
} from '#/features/courses/courses.curriculum-bulk'
import type { SoftDeletedItem } from '#/features/courses/courses.curriculum-bulk'

const NOW = Date.parse('2026-01-15T12:00:00Z')

describe('computePurgeCountdown', () => {
  test('30 days remaining when just deleted', () => {
    const item: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Deleted item',
      deletedAt: NOW,
      deletedBy: 'user-1',
    }
    const countdown = computePurgeCountdown(item, NOW)
    expect(countdown.daysRemaining).toBe(30)
    expect(countdown.isPastRetention).toBe(false)
  })

  test('0 days remaining at retention boundary', () => {
    const item: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Deleted item',
      deletedAt: NOW - 30 * 24 * 60 * 60 * 1000,
      deletedBy: 'user-1',
    }
    const countdown = computePurgeCountdown(item, NOW)
    expect(countdown.daysRemaining).toBe(0)
    expect(countdown.isPastRetention).toBe(true)
  })

  test('past retention when older than 30 days', () => {
    const item: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Deleted item',
      deletedAt: NOW - 45 * 24 * 60 * 60 * 1000,
      deletedBy: 'user-1',
    }
    const countdown = computePurgeCountdown(item, NOW)
    expect(countdown.isPastRetention).toBe(true)
  })
})

describe('purgeCountdownLabel', () => {
  test('just deleted shows "purges in 30 days"', () => {
    const item: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Item',
      deletedAt: NOW,
      deletedBy: 'user-1',
    }
    expect(purgeCountdownLabel(item, NOW)).toBe('purges in 30 days')
  })

  test('1 day remaining shows singular "day"', () => {
    const item: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Item',
      deletedAt: NOW - 29 * 24 * 60 * 60 * 1000,
      deletedBy: 'user-1',
    }
    expect(purgeCountdownLabel(item, NOW)).toBe('purges in 1 day')
  })

  test('0 days shows "purges today" when less than 1 whole day remains but not past retention', () => {
    // 0.5 days (12h) before expiry: remainingMs = 12h > 0 (not past retention),
    // daysRemaining = floor(12h / 24h) = 0 → "purges today".
    const almostExpired: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Item',
      deletedAt: NOW - SOFT_DELETE_RETENTION_MS + 12 * 60 * 60 * 1000, // 12h before expiry
      deletedBy: 'user-1',
    }
    const countdown = computePurgeCountdown(almostExpired, NOW)
    expect(countdown.isPastRetention).toBe(false)
    expect(countdown.daysRemaining).toBe(0)
    expect(purgeCountdownLabel(almostExpired, NOW)).toBe('purges today')
  })

  test('past retention shows "eligible for purge"', () => {
    const item: SoftDeletedItem = {
      itemId: 'i1',
      title: 'Item',
      deletedAt: NOW - 45 * 24 * 60 * 60 * 1000,
      deletedBy: 'user-1',
    }
    expect(purgeCountdownLabel(item, NOW)).toBe('eligible for purge')
  })
})

describe('itemsEligibleForPurge', () => {
  test('filters to items past retention', () => {
    const items: SoftDeletedItem[] = [
      { itemId: 'fresh', title: 'Fresh', deletedAt: NOW, deletedBy: 'u' },
      { itemId: 'old', title: 'Old', deletedAt: NOW - 45 * 24 * 60 * 60 * 1000, deletedBy: 'u' },
    ]
    const eligible = itemsEligibleForPurge(items, NOW)
    expect(eligible.map((i) => i.itemId)).toEqual(['old'])
  })
})

describe('computeSelectAllState (tri-state)', () => {
  test('unchecked when no items selected', () => {
    const state = computeSelectAllState(new Set(), ['i1', 'i2', 'i3'])
    expect(state).toBe('unchecked')
  })

  test('checked when all selectable items selected', () => {
    const state = computeSelectAllState(new Set(['i1', 'i2', 'i3']), ['i1', 'i2', 'i3'])
    expect(state).toBe('checked')
  })

  test('indeterminate when some but not all selected', () => {
    const state = computeSelectAllState(new Set(['i1', 'i2']), ['i1', 'i2', 'i3'])
    expect(state).toBe('indeterminate')
  })

  test('indeterminate when filtered set exceeds 50-item cap', () => {
    const filteredIds = Array.from({ length: 100 }, (_, i) => `i${i}`)
    const selected = new Set(filteredIds.slice(0, BULK_SELECTION_CAP))
    const state = computeSelectAllState(selected, filteredIds)
    expect(state).toBe('indeterminate')
  })

  test('checked when filtered set is exactly 50 and all selected', () => {
    const filteredIds = Array.from({ length: 50 }, (_, i) => `i${i}`)
    const selected = new Set(filteredIds)
    const state = computeSelectAllState(selected, filteredIds)
    expect(state).toBe('checked')
  })
})

describe('toggleSelectAll', () => {
  test('selects up to 50 items when toggling on', () => {
    const filteredIds = Array.from({ length: 100 }, (_, i) => `i${i}`)
    const result = toggleSelectAll('unchecked', new Set(), filteredIds)
    expect(result.size).toBe(50)
  })

  test('deselects all filtered items when toggling off', () => {
    const filteredIds = ['i1', 'i2', 'i3']
    const result = toggleSelectAll('checked', new Set(filteredIds), filteredIds)
    expect(result.size).toBe(0)
  })
})

describe('toggleItemSelection', () => {
  test('adds an item when not selected', () => {
    const result = toggleItemSelection(new Set(['i1']), 'i2')
    expect(result.has('i2')).toBe(true)
    expect(result.size).toBe(2)
  })

  test('removes an item when selected', () => {
    const result = toggleItemSelection(new Set(['i1', 'i2']), 'i1')
    expect(result.has('i1')).toBe(false)
    expect(result.size).toBe(1)
  })

  test('respects 50-item cap — no-op when at cap', () => {
    const selected = new Set(Array.from({ length: BULK_SELECTION_CAP }, (_, i) => `i${i}`))
    const result = toggleItemSelection(selected, 'new-item')
    expect(result.size).toBe(BULK_SELECTION_CAP)
    expect(result.has('new-item')).toBe(false)
  })
})

describe('isSelectionCapped', () => {
  test('true when at 50 items', () => {
    const selected = new Set(Array.from({ length: 50 }, (_, i) => `i${i}`))
    expect(isSelectionCapped(selected)).toBe(true)
  })

  test('false when below 50', () => {
    expect(isSelectionCapped(new Set(['i1', 'i2']))).toBe(false)
  })
})

describe('selectAllLabel', () => {
  test('simple count when below cap', () => {
    expect(selectAllLabel(10)).toBe('Select all 10')
  })

  test('cap note when above cap', () => {
    expect(selectAllLabel(100)).toBe('Select all 100 (first 50 selected)')
  })
})

describe('summarizeBulkAction', () => {
  test('all succeeded — simple count', () => {
    expect(
      summarizeBulkAction({
        action: 'archived',
        succeeded: ['i1', 'i2', 'i3'],
        failed: [],
      }),
    ).toBe('3 archived')
  })

  test('mixed results — "N archived · M failed — Retry failures"', () => {
    expect(
      summarizeBulkAction({
        action: 'archived',
        succeeded: ['i1', 'i2'],
        failed: [{ id: 'i3', error: 'conflict' }],
      }),
    ).toBe('2 archived · 1 failed — Retry failures')
  })
})

describe('hasMixedResults', () => {
  test('true when both succeeded and failed', () => {
    expect(
      hasMixedResults({
        action: 'archived',
        succeeded: ['i1'],
        failed: [{ id: 'i2', error: 'x' }],
      }),
    ).toBe(true)
  })

  test('false when all succeeded', () => {
    expect(
      hasMixedResults({
        action: 'archived',
        succeeded: ['i1'],
        failed: [],
      }),
    ).toBe(false)
  })
})
