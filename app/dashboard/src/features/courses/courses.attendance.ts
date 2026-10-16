/**
 * Live Session Attendance reconciliation (spec 04 § S-2.9 → Live Session
 * Scheduler → manual attendance fallback).
 *
 * Attendance records come from two sources:
 *
 * 1. **Provider** (Zoom / Google Meet) — written by the provider
 *    integration when available. The provider row is the source of truth
 *    when both exist.
 * 2. **Manual** — written by an Admin/Editor using the manual attendance
 *    fallback UI when the provider did not produce a record (e.g. the
 *    meeting was hosted externally, or the provider integration failed).
 *
 * Reconciliation rules:
 *
 * - A provider row is never overwritten by a manual row without
 *   confirmation. The provider row is the source of truth.
 * - A manual row can be edited; a provider row is read-only in the UI.
 * - When both exist for the same (session, user), the UI shows the
 *   provider row with a note that a manual override is available.
 * - A manual row that disagrees with a provider row is flagged for
 *   review.
 *
 * This module is framework-free: it owns the reconciliation logic.
 */

export type AttendanceStatus = 'present' | 'late' | 'absent'
export type AttendanceSource = 'provider' | 'manual'

export interface AttendanceRecord {
  readonly sessionId: string
  readonly userId: string
  readonly status: AttendanceStatus
  readonly source: AttendanceSource
  readonly markedBy: string | null
  readonly markedAt: number
}

export type ReconciliationResult =
  | { readonly kind: 'provider_only'; readonly record: AttendanceRecord }
  | { readonly kind: 'manual_only'; readonly record: AttendanceRecord }
  | {
      readonly kind: 'both_agree'
      readonly providerRecord: AttendanceRecord
      readonly manualRecord: AttendanceRecord
    }
  | {
      readonly kind: 'both_disagree'
      readonly providerRecord: AttendanceRecord
      readonly manualRecord: AttendanceRecord
      readonly flaggedForReview: true
    }
  | { readonly kind: 'neither' }

/**
 * Reconcile provider and manual attendance records for a single
 * (session, user) pair. The spec mandates the provider row is the source
 * of truth; a manual row that disagrees is flagged for review, not
 * silently applied.
 */
export function reconcileAttendance(
  providerRecord: AttendanceRecord | null,
  manualRecord: AttendanceRecord | null,
): ReconciliationResult {
  if (providerRecord && !manualRecord) {
    return { kind: 'provider_only', record: providerRecord }
  }
  if (!providerRecord && manualRecord) {
    return { kind: 'manual_only', record: manualRecord }
  }
  if (!providerRecord && !manualRecord) {
    return { kind: 'neither' }
  }
  // Both exist — check agreement.
  const p = providerRecord!
  const m = manualRecord!
  if (p.status === m.status) {
    return { kind: 'both_agree', providerRecord: p, manualRecord: m }
  }
  return {
    kind: 'both_disagree',
    providerRecord: p,
    manualRecord: m,
    flaggedForReview: true,
  }
}

/**
 * The effective attendance status after reconciliation. When both exist,
 * the provider row wins (source of truth). When only one exists, that
 * one wins. When neither exists, the user is assumed absent (but the
 * caller may render "Not marked" instead).
 */
export function effectiveStatus(result: ReconciliationResult): AttendanceStatus | null {
  switch (result.kind) {
    case 'provider_only':
      return result.record.status
    case 'manual_only':
      return result.record.status
    case 'both_agree':
    case 'both_disagree':
      return result.providerRecord.status // provider is source of truth
    case 'neither':
      return null
  }
}

/**
 * Whether a manual override can be applied. The spec allows a manual row
 * to override a provider row only with confirmation — a disagreement is
 * flagged for review, not silently applied.
 */
export function canApplyManualOverride(result: ReconciliationResult): boolean {
  return result.kind === 'manual_only' || result.kind === 'both_disagree'
}

/**
 * Compute attendance summary stats for a session. Used by the S-2.9
 * session detail view to show "12 present · 3 late · 5 absent · 4 not
 * marked".
 */
export interface AttendanceSummary {
  readonly present: number
  readonly late: number
  readonly absent: number
  readonly notMarked: number
  readonly total: number
}

export function summarizeAttendance(
  reconciled: ReadonlyArray<ReconciliationResult>,
  totalExpected: number,
): AttendanceSummary {
  const present = reconciled.filter((r) => effectiveStatus(r) === 'present').length
  const late = reconciled.filter((r) => effectiveStatus(r) === 'late').length
  const absent = reconciled.filter((r) => effectiveStatus(r) === 'absent').length
  const marked = present + late + absent
  const notMarked = Math.max(0, totalExpected - marked)
  return { present, late, absent, notMarked, total: totalExpected }
}
