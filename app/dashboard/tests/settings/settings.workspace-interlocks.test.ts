/**
 * Spec 13 § Safety interlocks — pure tests.
 *
 * Each interlock is a pure function: it takes the proposed change + the
 * workspace state and returns `{ ok: true }` or `{ ok: false, reason }`. The
 * reason names the fix per Part 11 § Gate-with-a-Way-Out.
 */
import { test, expect } from 'bun:test'
import {
  checkRequireMfaForAllInterlock,
  checkLockoutThresholdDecreaseInterlock,
  checkMaxMembersDecreaseInterlock,
  checkSelfServiceWorkspacesDecreaseInterlock,
  checkSessionTimeoutDecreaseInterlock,
  runAllInterlocks
  
} from '#/features/settings/settings.workspace-interlocks'
import type {InterlockContext} from '#/features/settings/settings.workspace-interlocks';
import { PLUGIN_DEFAULTS } from '#/features/settings/settings.workspace-policies'

function baseCtx(overrides: Partial<InterlockContext> = {}): InterlockContext {
  return {
    changes: {},
    current: { ...PLUGIN_DEFAULTS },
    memberCount: 5,
    ownerCount: 2,
    maxFailedAttempts: 0,
    hasActiveOwnerSession: false,
    usersOverNewOrganizationLimit: 0,
    ...overrides,
  }
}

test('requireMfaForAll: blocks when the workspace has exactly one owner', () => {
  const ctx = baseCtx({
    changes: { requireMfaFor: 'everyone' },
    ownerCount: 1,
  })
  const result = checkRequireMfaForAllInterlock(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.field).toBe('requireMfaFor')
    expect(result.reason).toContain('second admin')
  }
})

test('requireMfaForAll: passes when the workspace has two or more owners', () => {
  const ctx = baseCtx({
    changes: { requireMfaFor: 'everyone' },
    ownerCount: 2,
  })
  expect(checkRequireMfaForAllInterlock(ctx).ok).toBe(true)
})

test('requireMfaForAll: passes when the change is not "everyone"', () => {
  // 'editors+reviewers' and 'no_one' do not trigger the interlock — only
  // "everyone" requires the second-admin guard.
  const ctxEditors = baseCtx({ changes: { requireMfaFor: 'editors+reviewers' }, ownerCount: 1 })
  expect(checkRequireMfaForAllInterlock(ctxEditors).ok).toBe(true)
  const ctxNone = baseCtx({ changes: { requireMfaFor: 'no_one' }, ownerCount: 1 })
  expect(checkRequireMfaForAllInterlock(ctxNone).ok).toBe(true)
})

test('requireMfaForAll: passes when the change is not setting requireMfaFor at all', () => {
  const ctx = baseCtx({ changes: { membershipLimit: 50 }, ownerCount: 1 })
  expect(checkRequireMfaForAllInterlock(ctx).ok).toBe(true)
})

test('maxMembersDecrease: blocks when the new limit is below the current member count', () => {
  const ctx = baseCtx({
    changes: { membershipLimit: 10 },
    current: { ...PLUGIN_DEFAULTS, membershipLimit: 50 },
    memberCount: 12,
  })
  const result = checkMaxMembersDecreaseInterlock(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.field).toBe('membershipLimit')
    expect(result.reason).toContain('12 members')
    expect(result.reason).toContain('remove someone first')
  }
})

test('maxMembersDecrease: passes when the new limit is at or above the current count', () => {
  const ctx = baseCtx({
    changes: { membershipLimit: 15 },
    current: { ...PLUGIN_DEFAULTS, membershipLimit: 50 },
    memberCount: 12,
  })
  expect(checkMaxMembersDecreaseInterlock(ctx).ok).toBe(true)
})

test('maxMembersDecrease: passes on an increase', () => {
  const ctx = baseCtx({
    changes: { membershipLimit: 100 },
    current: { ...PLUGIN_DEFAULTS, membershipLimit: 50 },
    memberCount: 12,
  })
  expect(checkMaxMembersDecreaseInterlock(ctx).ok).toBe(true)
})

test('maxMembersDecrease: passes when membershipLimit is not being changed', () => {
  const ctx = baseCtx({ changes: { invitationLimit: 25 }, memberCount: 12 })
  expect(checkMaxMembersDecreaseInterlock(ctx).ok).toBe(true)
})

test('maxMembersDecrease: uses singular "member" when count is 1', () => {
  const ctx = baseCtx({
    changes: { membershipLimit: 0 },
    current: { ...PLUGIN_DEFAULTS, membershipLimit: 50 },
    memberCount: 1,
  })
  const result = checkMaxMembersDecreaseInterlock(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toContain('1 member')
    expect(result.reason).not.toContain('1 members')
  }
})

test('selfServiceWorkspacesDecrease: blocks when users are over the new limit', () => {
  const ctx = baseCtx({
    changes: { organizationLimit: 2 },
    current: { ...PLUGIN_DEFAULTS, organizationLimit: 5 },
    usersOverNewOrganizationLimit: 3,
  })
  const result = checkSelfServiceWorkspacesDecreaseInterlock(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.field).toBe('organizationLimit')
    expect(result.reason).toContain('3 people')
    expect(result.reason).toContain('Raise the limit')
  }
})

test('selfServiceWorkspacesDecrease: passes when no users are over the new limit', () => {
  const ctx = baseCtx({
    changes: { organizationLimit: 2 },
    current: { ...PLUGIN_DEFAULTS, organizationLimit: 5 },
    usersOverNewOrganizationLimit: 0,
  })
  expect(checkSelfServiceWorkspacesDecreaseInterlock(ctx).ok).toBe(true)
})

test('selfServiceWorkspacesDecrease: uses singular "person is" when count is 1', () => {
  const ctx = baseCtx({
    changes: { organizationLimit: 2 },
    current: { ...PLUGIN_DEFAULTS, organizationLimit: 5 },
    usersOverNewOrganizationLimit: 1,
  })
  const result = checkSelfServiceWorkspacesDecreaseInterlock(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toContain('1 person is')
    expect(result.reason).not.toContain('1 people are')
  }
})

test('sessionTimeoutDecrease: blocks when an owner session is active', () => {
  const ctx = baseCtx({
    changes: { sessionTimeoutMinutes: 15 },
    current: { ...PLUGIN_DEFAULTS, sessionTimeoutMinutes: 480 },
    hasActiveOwnerSession: true,
  })
  const result = checkSessionTimeoutDecreaseInterlock(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.field).toBe('sessionTimeoutMinutes')
    expect(result.reason).toContain('end your own session')
    expect(result.reason).toContain('Ask another admin')
  }
})

test('sessionTimeoutDecrease: passes when no owner session is active', () => {
  const ctx = baseCtx({
    changes: { sessionTimeoutMinutes: 15 },
    current: { ...PLUGIN_DEFAULTS, sessionTimeoutMinutes: 480 },
    hasActiveOwnerSession: false,
  })
  expect(checkSessionTimeoutDecreaseInterlock(ctx).ok).toBe(true)
})

test('sessionTimeoutDecrease: passes on an increase', () => {
  const ctx = baseCtx({
    changes: { sessionTimeoutMinutes: 1440 },
    current: { ...PLUGIN_DEFAULTS, sessionTimeoutMinutes: 480 },
    hasActiveOwnerSession: true,
  })
  // An increase does not end the current session — the timeout only shortens.
  expect(checkSessionTimeoutDecreaseInterlock(ctx).ok).toBe(true)
})

test('lockoutThresholdDecrease: blocks when below the recorded attempt count', () => {
  const ctx = baseCtx({ maxFailedAttempts: 5 })
  const result = checkLockoutThresholdDecreaseInterlock(ctx, 5, 3)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.field).toBe('accountLockoutMaxAttempts')
    expect(result.reason).toContain('3 attempts')
    expect(result.reason).toContain('5 already recorded')
  }
})

test('lockoutThresholdDecrease: passes when not decreasing', () => {
  const ctx = baseCtx({ maxFailedAttempts: 5 })
  // No env proposal → the interlock does not apply.
  expect(checkLockoutThresholdDecreaseInterlock(ctx, 5).ok).toBe(true)
  // Same value → not a decrease.
  expect(checkLockoutThresholdDecreaseInterlock(ctx, 5, 5).ok).toBe(true)
  // Higher value → an increase, safe.
  expect(checkLockoutThresholdDecreaseInterlock(ctx, 5, 10).ok).toBe(true)
})

test('runAllInterlocks: returns the first blocking interlock', () => {
  // Two interlocks would block: requireMfaForAll (single owner) and
  // maxMembersDecrease (limit below count). The spec's table order puts
  // requireMfaForAll first, so that's the one runAllInterlocks returns.
  const ctx = baseCtx({
    changes: { requireMfaFor: 'everyone', membershipLimit: 5 },
    current: { ...PLUGIN_DEFAULTS, membershipLimit: 50 },
    ownerCount: 1,
    memberCount: 12,
  })
  const result = runAllInterlocks(ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.field).toBe('requireMfaFor')
  }
})

test('runAllInterlocks: returns ok when every interlock passes', () => {
  const ctx = baseCtx({
    changes: { invitationLimit: 25, cancelPendingInvitationsOnReInvite: true },
    ownerCount: 2,
    memberCount: 5,
  })
  expect(runAllInterlocks(ctx).ok).toBe(true)
})

test('interlock reasons are human-readable and name the fix', () => {
  // Part 11 § Gate-with-a-Way-Out: a blocked save must name the fix, not just
  // the problem. Each reason should contain an action verb.
  const cases: Array<{ ctx: InterlockContext; expectedVerb: string }> = [
    {
      ctx: baseCtx({ changes: { requireMfaFor: 'everyone' }, ownerCount: 1 }),
      expectedVerb: 'Add',
    },
    {
      ctx: baseCtx({
        changes: { membershipLimit: 5 },
        current: { ...PLUGIN_DEFAULTS, membershipLimit: 50 },
        memberCount: 12,
      }),
      expectedVerb: 'remove',
    },
    {
      ctx: baseCtx({
        changes: { organizationLimit: 2 },
        current: { ...PLUGIN_DEFAULTS, organizationLimit: 5 },
        usersOverNewOrganizationLimit: 3,
      }),
      expectedVerb: 'Raise',
    },
    {
      ctx: baseCtx({
        changes: { sessionTimeoutMinutes: 15 },
        current: { ...PLUGIN_DEFAULTS, sessionTimeoutMinutes: 480 },
        hasActiveOwnerSession: true,
      }),
      expectedVerb: 'Ask',
    },
  ]
  for (const { ctx, expectedVerb } of cases) {
    const result = runAllInterlocks(ctx)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain(expectedVerb)
    }
  }
})
