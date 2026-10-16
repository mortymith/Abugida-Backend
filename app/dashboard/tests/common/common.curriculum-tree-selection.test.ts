import { describe, expect, test } from 'bun:test'
import {
  bulkActionResultLabel,
  bulkArchiveCapLabel,
  BULK_ARCHIVE_CAP,
  clearSelection,
  isBulkArchiveCapped,
  multiSelectAdd,
  multiSelectionAnnouncement,
  multiSelectRange,
  selectAllInSection,
  singleSelect,
} from '#/components/common/common.curriculum-tree-selection'
import type { SelectionState } from '#/components/common/common.curriculum-tree-selection'

const empty: SelectionState = { mode: 'none', activeRowId: null, selectedRowIds: new Set() }

describe('singleSelect', () => {
  test('sets mode to single + drives active row', () => {
    const result = singleSelect(empty, 'i1')
    expect(result.mode).toBe('single')
    expect(result.activeRowId).toBe('i1')
    expect(result.selectedRowIds.has('i1')).toBe(true)
  })
})
describe('multiSelectAdd', () => {
  test('adds to selection', () => {
    const result = multiSelectAdd(empty, 'i1')
    expect(result.mode).toBe('multi')
    expect(result.selectedRowIds.has('i1')).toBe(true)
  })
  test('toggles off if already selected', () => {
    const s1 = multiSelectAdd(empty, 'i1')
    const s2 = multiSelectAdd(s1, 'i1')
    expect(s2.selectedRowIds.has('i1')).toBe(false)
    expect(s2.mode).toBe('none')
  })
})
describe('multiSelectRange', () => {
  test('selects range from i1 to i3', () => {
    const allIds = ['i1', 'i2', 'i3', 'i4']
    const result = multiSelectRange(empty, 'i1', 'i3', allIds)
    expect(result.selectedRowIds.size).toBe(3)
    expect(result.selectedRowIds.has('i1')).toBe(true)
    expect(result.selectedRowIds.has('i2')).toBe(true)
    expect(result.selectedRowIds.has('i3')).toBe(true)
    expect(result.selectedRowIds.has('i4')).toBe(false)
  })
})
describe('clearSelection', () => {
  test('returns to single mode with active row', () => {
    const multi: SelectionState = {
      mode: 'multi',
      activeRowId: 'i1',
      selectedRowIds: new Set(['i1', 'i2', 'i3']),
    }
    const result = clearSelection(multi)
    expect(result.mode).toBe('single')
    expect(result.selectedRowIds.size).toBe(1)
    expect(result.selectedRowIds.has('i1')).toBe(true)
  })
  test('returns to none when no active row', () => {
    const result = clearSelection(empty)
    expect(result.mode).toBe('none')
    expect(result.selectedRowIds.size).toBe(0)
  })
})
describe('selectAllInSection', () => {
  test('adds all section items to selection', () => {
    const result = selectAllInSection(empty, ['i1', 'i2', 'i3'])
    expect(result.mode).toBe('multi')
    expect(result.selectedRowIds.size).toBe(3)
  })
})
describe('BULK_ARCHIVE_CAP', () => {
  test('is 50', () => expect(BULK_ARCHIVE_CAP).toBe(50))
})
describe('isBulkArchiveCapped', () => {
  test('false at 50', () => expect(isBulkArchiveCapped(50)).toBe(false))
  test('true at 51', () => expect(isBulkArchiveCapped(51)).toBe(true))
})
describe('bulkArchiveCapLabel', () => {
  test('names total matching count', () => {
    expect(bulkArchiveCapLabel(128)).toContain('128')
  })
})
describe('bulkActionResultLabel', () => {
  test('all succeeded', () => expect(bulkActionResultLabel(47, 0)).toBe('47 archived'))
  test('mixed results', () => {
    expect(bulkActionResultLabel(47, 3)).toContain('47 archived')
    expect(bulkActionResultLabel(47, 3)).toContain('3 failed')
    expect(bulkActionResultLabel(47, 3)).toContain('Retry')
  })
})
describe('multiSelectionAnnouncement', () => {
  test('singular for 1', () => expect(multiSelectionAnnouncement(1)).toBe('1 item selected'))
  test('plural for 3', () => expect(multiSelectionAnnouncement(3)).toBe('3 items selected'))
})
