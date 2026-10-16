/**
 * Recently Deleted + Bulk Selection logic (spec 04 § S-2.17 → Curriculum
 * sidebar, § Item Action Matrix).
 *
 * Two related contracts live here:
 *
 * 1. **Recently Deleted (30-day purge).** A soft-deleted item (`deletedAt`
 *    set) is retained for 30 days, during which it appears in the
 *    "Recently deleted (n)" sidebar view with a purge countdown. After 30
 *    days it is purged (hard delete) by a background worker. The spec
 *    calls for a "purges in N days" countdown on each row.
 *
 * 2. **Bulk selection (tri-state, 50-item cap).** The curriculum sidebar
 *    supports bulk selection with a tri-state checkbox
 *    (`aria-checked="mixed"`), a 50-item cap, and a "Select all N matching
 *    filter" affordance. Bulk actions report per-outcome results — never
 *    one success/failure toast for a mixed batch (spec 11 § Partial
 *    Failure).
 *
 * This module is framework-free: it owns the purge-countdown math, the
 * tri-state selection model, and the bulk-action outcome aggregation.
 */

export const SOFT_DELETE_RETENTION_DAYS = 30
export const SOFT_DELETE_RETENTION_MS = SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000
export const BULK_SELECTION_CAP = 50

// ── Recently Deleted ───────────────────────────────────────────────────────

export interface SoftDeletedItem {
  readonly itemId: string
  readonly title: string
  readonly deletedAt: number // epoch ms
  readonly deletedBy: string
}

export interface PurgeCountdown {
  readonly daysRemaining: number
  readonly purgesAt: number // epoch ms
  readonly isPastRetention: boolean
}

/**
 * Compute the purge countdown for a soft-deleted item.
 *
 * The spec renders "purges in N days" on each Recently Deleted row. `N`
 * is the number of whole days remaining until the 30-day retention window
 * expires. A row past retention (`isPastRetention: true`) is eligible for
 * immediate purge by the background worker.
 */
export function computePurgeCountdown(item: SoftDeletedItem, now: number): PurgeCountdown {
  const purgesAt = item.deletedAt + SOFT_DELETE_RETENTION_MS
  const remainingMs = purgesAt - now
  // floor (not ceil): a row with 0.5 days remaining shows "purges today"
  // (0 whole days), not "purges in 1 day". The spec's "purges today" label
  // is for the sub-day boundary.
  const daysRemaining = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)))
  return {
    daysRemaining,
    purgesAt,
    isPastRetention: remainingMs <= 0,
  }
}

/**
 * Human-readable purge label for the sidebar row.
 *
 * - "purges in 12 days" — normal case
 * - "purges today" — less than 1 day remaining
 * - "eligible for purge" — past retention, awaiting worker
 */
export function purgeCountdownLabel(item: SoftDeletedItem, now: number): string {
  const countdown = computePurgeCountdown(item, now)
  if (countdown.isPastRetention) return 'eligible for purge'
  if (countdown.daysRemaining === 0) return 'purges today'
  return `purges in ${countdown.daysRemaining} day${countdown.daysRemaining === 1 ? '' : 's'}`
}

/**
 * Filter a list of soft-deleted items to those eligible for purge.
 * Used by the background worker to find rows to hard-delete.
 */
export function itemsEligibleForPurge(
  items: readonly SoftDeletedItem[],
  now: number,
): SoftDeletedItem[] {
  return items.filter((item) => computePurgeCountdown(item, now).isPastRetention)
}

// ── Bulk selection (tri-state) ─────────────────────────────────────────────

export type TriState = 'unchecked' | 'checked' | 'indeterminate'

/**
 * Compute the tri-state for the "select all" checkbox given the current
 * selection state.
 *
 * - `unchecked` — no items selected
 * - `checked` — all filtered items selected (within the 50-item cap)
 * - `indeterminate` — some but not all selected
 *
 * The 50-item cap means "select all" selects at most 50 items. If the
 * filtered set is larger than 50, the checkbox is `indeterminate` even
 * when 50 are selected, because not *all* matching items are selected.
 */
export function computeSelectAllState(
  selectedIds: ReadonlySet<string>,
  filteredItemIds: readonly string[],
): TriState {
  if (filteredItemIds.length === 0) return 'unchecked'
  if (selectedIds.size === 0) return 'unchecked'

  const selectableIds = filteredItemIds.slice(0, BULK_SELECTION_CAP)
  const selectableSet = new Set(selectableIds)
  const selectedInFiltered = [...selectedIds].filter((id) => selectableSet.has(id))

  if (selectedInFiltered.length === 0) return 'unchecked'
  if (selectedInFiltered.length === selectableIds.length) {
    // All selectable items are selected. If the filtered set is larger
    // than the cap, we're still "indeterminate" because not *all* matching
    // items are selected.
    if (filteredItemIds.length > BULK_SELECTION_CAP) return 'indeterminate'
    return 'checked'
  }
  return 'indeterminate'
}

/**
 * Toggle the "select all" state. When toggling from unchecked/indeterminate
 * to checked, select up to 50 items. When toggling from checked to
 * unchecked, deselect all filtered items.
 */
export function toggleSelectAll(
  currentState: TriState,
  selectedIds: ReadonlySet<string>,
  filteredItemIds: readonly string[],
): Set<string> {
  const next = new Set(selectedIds)
  if (currentState === 'checked') {
    // Deselect all filtered items.
    for (const id of filteredItemIds) next.delete(id)
  } else {
    // Select up to 50 filtered items.
    const selectableIds = filteredItemIds.slice(0, BULK_SELECTION_CAP)
    for (const id of selectableIds) next.add(id)
  }
  return next
}

/**
 * Toggle a single item's selection. Respects the 50-item cap: if the cap
 * is reached, adding a new item is a no-op (the caller shows a toast).
 */
export function toggleItemSelection(selectedIds: ReadonlySet<string>, itemId: string): Set<string> {
  const next = new Set(selectedIds)
  if (next.has(itemId)) {
    next.delete(itemId)
  } else {
    if (next.size >= BULK_SELECTION_CAP) {
      // Cap reached — return the set unchanged. The caller is responsible
      // for surfacing the cap-reached toast.
      return next
    }
    next.add(itemId)
  }
  return next
}

/**
 * Whether the selection has reached the 50-item cap. Used to show the
 * "Bulk selection limited to 50 items" toast when the user tries to
 * select more.
 */
export function isSelectionCapped(selectedIds: ReadonlySet<string>): boolean {
  return selectedIds.size >= BULK_SELECTION_CAP
}

/**
 * The "Select all N matching filter" label. When the filtered set is
 * larger than 50, the spec calls for this label so the user understands
 * the cap applies.
 */
export function selectAllLabel(filteredItemCount: number): string {
  if (filteredItemCount <= BULK_SELECTION_CAP) {
    return `Select all ${filteredItemCount}`
  }
  return `Select all ${filteredItemCount} (first ${BULK_SELECTION_CAP} selected)`
}

// ── Bulk action outcome reporting ──────────────────────────────────────────
//
// spec 11 § Partial Failure: "47 archived · 3 failed — Retry failures".
// Never one success/failure toast for a mixed batch.

export type BulkActionOutcome = 'succeeded' | 'failed'

export interface BulkActionResult {
  readonly action: string
  readonly succeeded: readonly string[]
  readonly failed: readonly { id: string; error: string }[]
}

/**
 * Summarize a bulk action result for the toast. The spec format is
 * "N {action} · M failed — Retry failures" when there are failures, or
 * "N {action}" when all succeeded.
 */
export function summarizeBulkAction(result: BulkActionResult): string {
  const { action, succeeded, failed } = result
  if (failed.length === 0) {
    return `${succeeded.length} ${action}`
  }
  return `${succeeded.length} ${action} · ${failed.length} failed — Retry failures`
}

/**
 * Whether a bulk action had mixed results (some succeeded, some failed).
 * The caller uses this to decide whether to show the per-item failure
 * report or a simple success toast.
 */
export function hasMixedResults(result: BulkActionResult): boolean {
  return result.succeeded.length > 0 && result.failed.length > 0
}
