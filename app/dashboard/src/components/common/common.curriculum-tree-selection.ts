/**
 * S-7.9 Curriculum Tree selection model (spec 09 § S-7.9).
 * Three-mode selection: single (drives pane), multi (bulk-only), none (escape).
 */

export type SelectionMode = 'single' | 'multi' | 'none'

export interface SelectionState {
  readonly mode: SelectionMode
  readonly activeRowId: string | null
  readonly selectedRowIds: ReadonlySet<string>
}

export function singleSelect(_state: SelectionState, rowId: string): SelectionState {
  return {
    mode: 'single',
    activeRowId: rowId,
    selectedRowIds: new Set([rowId]),
  }
}

export function multiSelectAdd(state: SelectionState, rowId: string): SelectionState {
  const newSet = new Set(state.selectedRowIds)
  if (newSet.has(rowId)) {
    newSet.delete(rowId)
  } else {
    newSet.add(rowId)
  }
  return {
    mode: newSet.size > 0 ? 'multi' : 'none',
    activeRowId: state.activeRowId,
    selectedRowIds: newSet,
  }
}

export function multiSelectRange(
  state: SelectionState,
  fromRowId: string,
  toRowId: string,
  allRowIds: readonly string[],
): SelectionState {
  const fromIdx = allRowIds.indexOf(fromRowId)
  const toIdx = allRowIds.indexOf(toRowId)
  if (fromIdx === -1 || toIdx === -1) return state
  const start = Math.min(fromIdx, toIdx)
  const end = Math.max(fromIdx, toIdx)
  const newSet = new Set(state.selectedRowIds)
  for (let i = start; i <= end; i++) {
    newSet.add(allRowIds[i])
  }
  return {
    mode: 'multi',
    activeRowId: toRowId,
    selectedRowIds: newSet,
  }
}

export function clearSelection(state: SelectionState): SelectionState {
  return {
    mode: state.activeRowId ? 'single' : 'none',
    activeRowId: state.activeRowId,
    selectedRowIds: state.activeRowId ? new Set([state.activeRowId]) : new Set(),
  }
}

export function selectAllInSection(
  state: SelectionState,
  sectionRowIds: readonly string[],
): SelectionState {
  const newSet = new Set(state.selectedRowIds)
  for (const id of sectionRowIds) {
    newSet.add(id)
  }
  return {
    mode: 'multi',
    activeRowId: state.activeRowId,
    selectedRowIds: newSet,
  }
}

export const BULK_ARCHIVE_CAP = 50

export function isBulkArchiveCapped(count: number): boolean {
  return count > BULK_ARCHIVE_CAP
}

export function bulkArchiveCapLabel(totalMatching: number): string {
  return `Select all ${totalMatching} items matching the filter`
}

export function bulkActionResultLabel(succeeded: number, failed: number): string {
  if (failed === 0) {
    return `${succeeded} archived`
  }
  return `${succeeded} archived · ${failed} failed — Retry failures`
}

export function multiSelectionAnnouncement(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'} selected`
}
