import { describe, expect, test } from 'bun:test'
import {
  buildItemActionsMenu,
  isMenuReplacedByExplanation,
  reviewLockExplanation,
  shouldFocusRename,
} from '#/components/common/common.item-actions-menu'
import type { MenuItemMenuContext } from '#/components/common/common.item-actions-menu'

const baseCtx: MenuItemMenuContext = {
  kind: 'lesson',
  isFirst: false,
  isLast: false,
  sectionCount: 3,
  isLockedByReview: false,
  isArchived: false,
  canEdit: true,
  hasUnlockRules: false,
}

describe('buildItemActionsMenu', () => {
  test('includes rename, duplicate, archive, delete', () => {
    const menu = buildItemActionsMenu(baseCtx)
    const ids = menu.map((e) => e.id)
    expect(ids).toContain('rename')
    expect(ids).toContain('duplicate')
    expect(ids).toContain('archive')
    expect(ids).toContain('delete')
  })
  test('delete is destructive + separator before archive', () => {
    const menu = buildItemActionsMenu(baseCtx)
    const archive = menu.find((e) => e.id === 'archive')
    const deleteEntry = menu.find((e) => e.id === 'delete')
    expect(archive?.separatorBefore).toBe(true)
    expect(deleteEntry?.destructive).toBe(true)
  })
  test('move_up disabled with reason at first position', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, isFirst: true })
    const moveUp = menu.find((e) => e.id === 'move_up')
    expect(moveUp?.state.kind).toBe('disabled')
    if (moveUp?.state.kind === 'disabled') {
      expect(moveUp.state.reason).toContain('Already first')
    }
  })
  test('move_down disabled with reason at last position', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, isLast: true })
    const moveDown = menu.find((e) => e.id === 'move_down')
    expect(moveDown?.state.kind).toBe('disabled')
  })
  test('move_to_section absent in single-section course', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, sectionCount: 1 })
    expect(menu.find((e) => e.id === 'move_to_section')).toBeUndefined()
  })
  test('quiz shows Questions + AI draft quiz', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, kind: 'quiz' })
    expect(menu.find((e) => e.id === 'questions')).toBeDefined()
    expect(menu.find((e) => e.id === 'ai_draft_quiz')).toBeDefined()
  })
  test('assignment shows Grading', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, kind: 'assignment' })
    expect(menu.find((e) => e.id === 'grading')).toBeDefined()
  })
  test('archived item shows Restore + Delete permanently only', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, isArchived: true })
    const ids = menu.map((e) => e.id)
    expect(ids).toContain('duplicate')
    expect(ids).toContain('delete')
    expect(ids).not.toContain('rename')
    expect(ids).not.toContain('archive')
  })
  test('empty when !canEdit (read-only role)', () => {
    expect(buildItemActionsMenu({ ...baseCtx, canEdit: false })).toEqual([])
  })
  test('only open_in_new_tab when locked by review', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, isLockedByReview: true })
    expect(menu).toHaveLength(1)
    expect(menu[0].id).toBe('open_in_new_tab')
  })
})
describe('shouldFocusRename', () => {
  test('true when rename is available', () => {
    const menu = buildItemActionsMenu(baseCtx)
    expect(shouldFocusRename(menu)).toBe(true)
  })
  test('false when no rename (archived)', () => {
    const menu = buildItemActionsMenu({ ...baseCtx, isArchived: true })
    expect(shouldFocusRename(menu)).toBe(false)
  })
})
describe('isMenuReplacedByExplanation', () => {
  test('true when locked by review', () => {
    expect(isMenuReplacedByExplanation({ ...baseCtx, isLockedByReview: true })).toBe(true)
  })
  test('false when not locked', () => {
    expect(isMenuReplacedByExplanation(baseCtx)).toBe(false)
  })
})
describe('reviewLockExplanation', () => {
  test('mentions locked + review', () => {
    expect(reviewLockExplanation()).toContain('locked')
    expect(reviewLockExplanation()).toContain('review')
  })
})
