/**
 * S-6.11 Danger Zone logic (spec 08 § S-6.11). Transfer ownership, export
 * workspace data, delete workspace (30-day soft delete + restore + purge).
 */

export const WORKSPACE_RECOVERY_DAYS = 30
export const WORKSPACE_RECOVERY_MS = WORKSPACE_RECOVERY_DAYS * 24 * 60 * 60 * 1000

export type TransferStatus = 'none' | 'pending' | 'accepted' | 'declined' | 'expired'

export interface WorkspaceState {
  readonly name: string
  readonly purgeScheduledAt: number | null
  readonly purgedAt: number | null
  readonly restoreExpiresAt: number | null
  readonly transferStatus: TransferStatus
  readonly transferredToId: string | null
}

/**
 * Whether the workspace is soft-deleted (within the 30-day recovery window).
 */
export function isSoftDeleted(ws: WorkspaceState, _now: number): boolean {
  return ws.purgeScheduledAt !== null && ws.purgedAt === null
}

/**
 * Whether the workspace is past the recovery window and should be purged.
 */
export function isPastRecoveryWindow(ws: WorkspaceState, now: number): boolean {
  if (!ws.restoreExpiresAt) return false
  return now >= ws.restoreExpiresAt
}

/**
 * Days remaining in the recovery window.
 */
export function daysRemainingInRecovery(ws: WorkspaceState, now: number): number {
  if (!ws.restoreExpiresAt) return 0
  return Math.max(0, Math.ceil((ws.restoreExpiresAt - now) / (24 * 60 * 60 * 1000)))
}

/**
 * The soft-deleted banner label. "This workspace is scheduled for deletion
 * on {date}. {N} days left to restore."
 */
export function softDeletedBannerLabel(ws: WorkspaceState, now: number): string | null {
  if (!isSoftDeleted(ws, now)) return null
  const days = daysRemainingInRecovery(ws, now)
  const purgeDate = ws.restoreExpiresAt
    ? new Date(ws.restoreExpiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'unknown'
  return `This workspace is scheduled for deletion on ${purgeDate}. ${days} day${days === 1 ? '' : 's'} left to restore.`
}

/**
 * Whether delete can be scheduled. Blocked while a payout run is active.
 */
export function canScheduleDeletion(payoutRunActive: boolean): {
  permitted: boolean
  reason: string | null
} {
  if (payoutRunActive) {
    return { permitted: false, reason: 'A payout run is active. Try again after it completes.' }
  }
  return { permitted: true, reason: null }
}

/**
 * Whether transfer can be initiated. Target must be a current Admin.
 */
export function canTransferOwnership(
  targetIsAdmin: boolean,
  isSelf: boolean,
): { permitted: boolean; reason: string | null } {
  if (isSelf) return { permitted: false, reason: 'You cannot transfer ownership to yourself.' }
  if (!targetIsAdmin)
    return { permitted: false, reason: 'The target must be a current Admin of this workspace.' }
  return { permitted: true, reason: null }
}

/**
 * The transfer state label. "Awaiting acceptance from {name}" or null.
 */
export function transferStateLabel(ws: WorkspaceState, targetName: string | null): string | null {
  if (ws.transferStatus === 'pending' && targetName) {
    return `Awaiting acceptance from ${targetName}`
  }
  if (ws.transferStatus === 'accepted') {
    return 'Transfer accepted'
  }
  return null
}

/**
 * Whether the typed workspace name matches for the destructive confirmation.
 */
export function isDeletionConfirmationValid(typedName: string, workspaceName: string): boolean {
  return typedName.trim() === workspaceName.trim()
}

/**
 * Compute the restore expiry (30 days from scheduling).
 */
export function computeRestoreExpiry(scheduledAt: number): Date {
  return new Date(scheduledAt + WORKSPACE_RECOVERY_MS)
}
