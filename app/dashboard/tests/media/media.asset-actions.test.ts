import { describe, expect, test } from 'bun:test'
import {
  ASSET_ACTION_IDS,
  buildAssetActionsMenu,
  isReversible,
  requiresConfirmation,
} from '#/features/media/media.asset-actions'

describe('ASSET_ACTION_IDS', () => {
  test('includes archive, restore, move, detach, delete', () => {
    expect(ASSET_ACTION_IDS).toEqual([
      'archive',
      'restore',
      'move_to_folder',
      'detach_from_all',
      'delete_permanently',
    ])
  })
})

describe('buildAssetActionsMenu', () => {
  test('empty when canEdit is false (case 1: absent, not disabled)', () => {
    expect(buildAssetActionsMenu({ isArchived: false, useCount: 5, canEdit: false })).toEqual([])
  })

  test('restore-only when archived', () => {
    const menu = buildAssetActionsMenu({ isArchived: true, useCount: 5, canEdit: true })
    expect(menu).toHaveLength(1)
    expect(menu[0].id).toBe('restore')
  })

  test('reversible-first ordering: archive, move, detach, separator, delete', () => {
    const menu = buildAssetActionsMenu({ isArchived: false, useCount: 5, canEdit: true })
    const ids = menu.map((m) => m.id)
    expect(ids).toEqual(['archive', 'move_to_folder', 'detach_from_all', 'delete_permanently'])
  })

  test('separator before delete', () => {
    const menu = buildAssetActionsMenu({ isArchived: false, useCount: 5, canEdit: true })
    const deleteItem = menu.find((m) => m.id === 'delete_permanently')
    expect(deleteItem?.separatorBefore).toBe(true)
    expect(deleteItem?.destructive).toBe(true)
  })

  test('detach absent when useCount === 0', () => {
    const menu = buildAssetActionsMenu({ isArchived: false, useCount: 0, canEdit: true })
    expect(menu.find((m) => m.id === 'detach_from_all')).toBeUndefined()
  })
})

describe('requiresConfirmation', () => {
  test('true for delete_permanently', () => {
    expect(requiresConfirmation('delete_permanently')).toBe(true)
  })
  test('true for detach_from_all', () => {
    expect(requiresConfirmation('detach_from_all')).toBe(true)
  })
  test('false for archive', () => {
    expect(requiresConfirmation('archive')).toBe(false)
  })
  test('false for move_to_folder', () => {
    expect(requiresConfirmation('move_to_folder')).toBe(false)
  })
})

describe('isReversible', () => {
  test('true for archive', () => {
    expect(isReversible('archive')).toBe(true)
  })
  test('true for move_to_folder', () => {
    expect(isReversible('move_to_folder')).toBe(true)
  })
  test('false for delete_permanently', () => {
    expect(isReversible('delete_permanently')).toBe(false)
  })
})
