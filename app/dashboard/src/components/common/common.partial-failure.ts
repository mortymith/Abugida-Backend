/**
 * Spec 11 § Resilience States → Partial failure: per-field / per-row
 * failure reporting. "Saved 8 of 9 fields. Discount limit was rejected —
 * see below." / "47 archived · 3 failed — Retry failures"
 */

export interface PartialFailureResult {
  readonly succeeded: number
  readonly failed: number
  readonly failedItems: ReadonlyArray<{ id: string; label: string; error: string }>
}

export function formatPartialFailure(result: PartialFailureResult): string {
  if (result.failed === 0)
    return `Saved ${result.succeeded} ${result.succeeded === 1 ? 'field' : 'fields'}.`
  const failedNames = result.failedItems.map((f) => f.label).join(', ')
  return `Saved ${result.succeeded} of ${result.succeeded + result.failed}. ${failedNames} was rejected — see below.`
}

export function formatBulkPartialFailure(
  action: string,
  succeeded: number,
  failed: number,
): string {
  if (failed === 0) return `${succeeded} ${action}`
  return `${succeeded} ${action} · ${failed} failed — Retry failures`
}

export function hasPartialFailure(succeeded: number, failed: number): boolean {
  return failed > 0 && succeeded > 0
}
