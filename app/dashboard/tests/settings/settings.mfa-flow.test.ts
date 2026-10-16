import { describe, expect, test } from 'bun:test'
import {
  BACKUP_CODE_COUNT,
  backupCodesWarning,
  canUnlinkProvider,
  generateBackupCodes,
  isMfaOffDuringFlow,
  isValidTotpCode,
  mfaMidFlowWarning,
} from '#/features/settings/settings.mfa-flow'
import type { MfaState } from '#/features/settings/settings.mfa-flow'

describe('isMfaOffDuringFlow', () => {
  test('true for mid_flow', () => {
    const state: MfaState = { kind: 'mid_flow', step: 'scan_or_copy' }
    expect(isMfaOffDuringFlow(state)).toBe(true)
  })
  test('false for off', () => {
    expect(isMfaOffDuringFlow({ kind: 'off' })).toBe(false)
  })
  test('false for enabled', () => {
    expect(isMfaOffDuringFlow({ kind: 'enabled', enrolledAt: 0 })).toBe(false)
  })
})
describe('mfaMidFlowWarning', () => {
  test('mentions two-factor is still off', () => {
    expect(mfaMidFlowWarning()).toContain('two-factor is still off')
  })
})
describe('canUnlinkProvider', () => {
  test('blocked when last provider', () => {
    const r = canUnlinkProvider(1)
    expect(r.permitted).toBe(false)
    expect(r.reason).toContain('at least one sign-in method')
  })
  test('permitted with 2+ providers', () => {
    expect(canUnlinkProvider(2).permitted).toBe(true)
  })
})
describe('generateBackupCodes', () => {
  test('generates 10 codes', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(BACKUP_CODE_COUNT)
  })
  test('each code is 8 chars', () => {
    const codes = generateBackupCodes()
    for (const code of codes) {
      expect(code).toHaveLength(8)
    }
  })
  test('codes use unambiguous alphabet', () => {
    const codes = generateBackupCodes()
    for (const code of codes) {
      expect(code).not.toMatch(/[0O1Il]/)
    }
  })
})
describe('backupCodesWarning', () => {
  test('mentions shown once', () => {
    expect(backupCodesWarning()).toContain('shown once')
  })
})
describe('isValidTotpCode', () => {
  test('true for 6 digits', () => expect(isValidTotpCode('123456')).toBe(true))
  test('false for 5 digits', () => expect(isValidTotpCode('12345')).toBe(false))
  test('false for letters', () => expect(isValidTotpCode('abcdef')).toBe(false))
})
