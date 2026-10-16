import { describe, expect, test } from 'bun:test'
import {
  canRemoveMember,
  deriveSignInMethod,
  emailCellLabel,
  isSelfRowReadOnly,
  roleConflictLabel,
  signInMethodLabel,
} from '#/features/settings/settings.team-conflict'
import type { MemberRow } from '#/features/settings/settings.team-conflict'

const member: MemberRow = {
  userId: 'u1',
  name: 'John',
  email: 'j@b.com',
  role: 'admin',
  rowVersion: 1,
  roleChangedAt: null,
  roleChangedBy: null,
}

describe('deriveSignInMethod', () => {
  test('google+telegram', () => expect(deriveSignInMethod(true, true)).toBe('google+telegram'))
  test('google only', () => expect(deriveSignInMethod(true, false)).toBe('google'))
  test('telegram only', () => expect(deriveSignInMethod(false, true)).toBe('telegram'))
  test('none', () => expect(deriveSignInMethod(false, false)).toBe('none'))
})
describe('signInMethodLabel', () => {
  test('Google + Telegram', () =>
    expect(signInMethodLabel('google+telegram')).toBe('Google + Telegram'))
  test('— for none', () => expect(signInMethodLabel('none')).toBe('—'))
})
describe('canRemoveMember', () => {
  test('blocked for self', () => {
    expect(canRemoveMember(member, 'u1', 2).permitted).toBe(false)
    expect(canRemoveMember(member, 'u1', 2).reason).toContain('yourself')
  })
  test('blocked for last admin', () => {
    expect(canRemoveMember({ ...member, role: 'admin' }, 'u2', 1).permitted).toBe(false)
    expect(canRemoveMember({ ...member, role: 'admin' }, 'u2', 1).reason).toContain('last Admin')
  })
  test('permitted for non-last admin', () => {
    expect(canRemoveMember({ ...member, role: 'admin' }, 'u2', 2).permitted).toBe(true)
  })
  test('permitted for non-admin', () => {
    expect(canRemoveMember({ ...member, role: 'editor' }, 'u2', 1).permitted).toBe(true)
  })
})
describe('isSelfRowReadOnly', () => {
  test('true for self', () => expect(isSelfRowReadOnly(member, 'u1')).toBe(true))
  test('false for other', () => expect(isSelfRowReadOnly(member, 'u2')).toBe(false))
})
describe('emailCellLabel', () => {
  test('returns email when present', () => expect(emailCellLabel('j@b.com')).toBe('j@b.com'))
  test('returns — when null', () => expect(emailCellLabel(null)).toBe('—'))
})
describe('roleConflictLabel', () => {
  test('names actor + minutes ago', () => {
    const now = Date.now()
    const m: MemberRow = { ...member, roleChangedAt: now - 5 * 60 * 1000, roleChangedBy: 'u2' }
    const label = roleConflictLabel(m, 'Jane', now)
    expect(label).toContain('Jane')
    expect(label).toContain('5 minutes')
  })
  test('null when no role change', () => {
    expect(roleConflictLabel(member, 'Jane', Date.now())).toBeNull()
  })
})
