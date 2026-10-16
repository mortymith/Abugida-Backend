import { describe, expect, test } from 'bun:test'
import {
  canScheduleDeletion,
  canTransferOwnership,
  computeRestoreExpiry,
  isDeletionConfirmationValid,
  isPastRecoveryWindow,
  isSoftDeleted,
  softDeletedBannerLabel,
  transferStateLabel,
  WORKSPACE_RECOVERY_DAYS,
} from '#/features/settings/settings.danger-zone'
import type { WorkspaceState } from '#/features/settings/settings.danger-zone'

const NOW = Date.parse('2026-01-15T12:00:00Z')
const activeWs: WorkspaceState = {
  name: 'Abugida',
  purgeScheduledAt: null,
  purgedAt: null,
  restoreExpiresAt: null,
  transferStatus: 'none',
  transferredToId: null,
}
const softDeletedWs: WorkspaceState = {
  name: 'Abugida',
  purgeScheduledAt: NOW - 5 * 24 * 60 * 60 * 1000,
  purgedAt: null,
  restoreExpiresAt: NOW + 25 * 24 * 60 * 60 * 1000,
  transferStatus: 'none',
  transferredToId: null,
}

describe('isSoftDeleted', () => {
  test('false for active', () => expect(isSoftDeleted(activeWs, NOW)).toBe(false))
  test('true when purgeScheduled and not purged', () =>
    expect(isSoftDeleted(softDeletedWs, NOW)).toBe(true))
})
describe('isPastRecoveryWindow', () => {
  test('false within window', () => expect(isPastRecoveryWindow(softDeletedWs, NOW)).toBe(false))
  test('true past window', () =>
    expect(isPastRecoveryWindow(softDeletedWs, NOW + 26 * 24 * 60 * 60 * 1000)).toBe(true))
})
describe('softDeletedBannerLabel', () => {
  test('null for active', () => expect(softDeletedBannerLabel(activeWs, NOW)).toBeNull())
  test('names days + date for soft-deleted', () => {
    const label = softDeletedBannerLabel(softDeletedWs, NOW)
    expect(label).toContain('25 day')
    expect(label).toContain('restore')
  })
})
describe('canScheduleDeletion', () => {
  test('blocked when payout run active', () => {
    const r = canScheduleDeletion(true)
    expect(r.permitted).toBe(false)
    expect(r.reason).toContain('payout')
  })
  test('permitted when no payout run', () => {
    expect(canScheduleDeletion(false).permitted).toBe(true)
  })
})
describe('canTransferOwnership', () => {
  test('blocked for self', () => expect(canTransferOwnership(true, true).permitted).toBe(false))
  test('blocked for non-admin', () =>
    expect(canTransferOwnership(false, false).permitted).toBe(false))
  test('permitted for other admin', () =>
    expect(canTransferOwnership(true, false).permitted).toBe(true))
})
describe('isDeletionConfirmationValid', () => {
  test('true when typed name matches', () =>
    expect(isDeletionConfirmationValid('Abugida', 'Abugida')).toBe(true))
  test('false when mismatch', () =>
    expect(isDeletionConfirmationValid('Wrong', 'Abugida')).toBe(false))
})
describe('computeRestoreExpiry', () => {
  test('30 days from scheduling', () => {
    expect(computeRestoreExpiry(NOW).getTime() - NOW).toBe(
      WORKSPACE_RECOVERY_DAYS * 24 * 60 * 60 * 1000,
    )
  })
})
describe('transferStateLabel', () => {
  test('pending names target', () => {
    const ws: WorkspaceState = { ...activeWs, transferStatus: 'pending', transferredToId: 'u1' }
    expect(transferStateLabel(ws, 'Jane')).toContain('Awaiting acceptance from Jane')
  })
  test('accepted', () => {
    const ws: WorkspaceState = { ...activeWs, transferStatus: 'accepted', transferredToId: 'u1' }
    expect(transferStateLabel(ws, null)).toBe('Transfer accepted')
  })
})
