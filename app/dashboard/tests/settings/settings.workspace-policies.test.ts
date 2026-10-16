/**
 * Spec 13 § Configuration Surface — workspace policy defaults + provenance.
 *
 * Pure tests for the resolver functions. The server impl reads the org's
 * policies jsonb and the env, then calls these resolvers; the resolvers
 * themselves are pure so `bun test` can exercise every precedence case
 * without a DB or env shim.
 */
import { test, expect } from 'bun:test'
import {
  PLUGIN_DEFAULTS,
  WORKSPACE_CONFIG_FIELDS,
  SESSION_TIMEOUT_OPTIONS_MINUTES,
  MFA_REQUIRED_OPTIONS,
  MFA_REQUIRED_LABELS,
  ENV_POLICY_KEYS,
  resolveWorkspaceEntry,
  resolveEnvironmentEntry,
  formatSessionTimeout,
} from '#/features/settings/settings.workspace-policies'
import type { WorkspacePolicies } from '@abugida/database/auth'

test('PLUGIN_DEFAULTS matches the spec configurable-values table', () => {
  // Spec 13 § Configurable values — the "Default now" column. Rows marked
  // "Unconfigured" in the spec are represented as the value the plugin
  // silently falls back to.
  expect(PLUGIN_DEFAULTS.invitationExpiresInDays).toBe(2) // plugin default 48h
  expect(PLUGIN_DEFAULTS.organizationLimit).toBe(1)
  expect(PLUGIN_DEFAULTS.cancelPendingInvitationsOnReInvite).toBe(false)
  expect(PLUGIN_DEFAULTS.allowUserToCreateOrganization).toBe(true)
  expect(PLUGIN_DEFAULTS.requireMfaFor).toBe('no_one')
  expect(PLUGIN_DEFAULTS.membershipLimit).toBeNull() // unlimited
  expect(PLUGIN_DEFAULTS.invitationLimit).toBeNull() // unlimited
  expect(PLUGIN_DEFAULTS.sessionTimeoutMinutes).toBeNull() // unconfigured
  expect(PLUGIN_DEFAULTS.sessionRevocationOnRoleChange).toBe(false)
})

test('WORKSPACE_CONFIG_FIELDS covers every spec-13 policy', () => {
  // The S-13.1 wireframe shows: MEMBERS (2), INVITATIONS (3), SECURITY (4).
  // Together that's 9 fields — the 9 in WORKSPACE_CONFIG_FIELDS.
  expect(WORKSPACE_CONFIG_FIELDS).toHaveLength(9)
  const keys = WORKSPACE_CONFIG_FIELDS.map((f) => f.key)
  expect(keys).toContain('membershipLimit')
  expect(keys).toContain('allowUserToCreateOrganization')
  expect(keys).toContain('organizationLimit')
  expect(keys).toContain('invitationExpiresInDays')
  expect(keys).toContain('invitationLimit')
  expect(keys).toContain('cancelPendingInvitationsOnReInvite')
  expect(keys).toContain('requireMfaFor')
  expect(keys).toContain('sessionTimeoutMinutes')
  expect(keys).toContain('sessionRevocationOnRoleChange')
})

test('ENV_POLICY_KEYS covers every env-overridable value', () => {
  // Spec 13 § Configurable values — the "Env-overridable" column. 5 of them.
  expect(ENV_POLICY_KEYS).toHaveLength(5)
  expect(ENV_POLICY_KEYS).toContain('totpIssuer')
  expect(ENV_POLICY_KEYS).toContain('twoFactorCookieMaxAge')
  expect(ENV_POLICY_KEYS).toContain('trustDeviceMaxAge')
  expect(ENV_POLICY_KEYS).toContain('accountLockoutMaxAttempts')
  expect(ENV_POLICY_KEYS).toContain('accountLockoutDurationSeconds')
})

test('SESSION_TIMEOUT_OPTIONS_MINUTES matches the spec dropdown', () => {
  // Spec: 15 m / 1 h / 8 h / 24 h / 7 d
  expect(SESSION_TIMEOUT_OPTIONS_MINUTES).toEqual([15, 60, 480, 1440, 10080])
})

test('MFA_REQUIRED_OPTIONS matches the spec radio group', () => {
  // Spec: Everyone / Editors+Reviewers / No one
  expect(MFA_REQUIRED_OPTIONS).toEqual(['everyone', 'editors+reviewers', 'no_one'])
  expect(MFA_REQUIRED_LABELS.everyone).toBe('Everyone')
  expect(MFA_REQUIRED_LABELS['editors+reviewers']).toBe('Editors + Reviewers')
  expect(MFA_REQUIRED_LABELS.no_one).toBe('No one')
})

test('resolveWorkspaceEntry reports "workspace" when the policy is set', () => {
  const policies: WorkspacePolicies = {
    ...PLUGIN_DEFAULTS,
    membershipLimit: 50,
  }
  const entry = resolveWorkspaceEntry({
    key: 'membershipLimit',
    policies,
    label: 'Max members per workspace',
    range: '1–500',
  })
  expect(entry.source).toBe('workspace')
  expect(entry.value).toBe(50)
  expect(entry.defaultValue).toBeNull() // plugin default is unlimited
  expect(entry.label).toBe('Max members per workspace')
  expect(entry.range).toBe('1–500')
})

test('resolveWorkspaceEntry reports "plugin_default" when the policy is unset', () => {
  // A brand-new workspace has policies = null. Every field should report
  // source: 'plugin_default' with the plugin's own default as both value
  // and defaultValue.
  const entry = resolveWorkspaceEntry({
    key: 'invitationExpiresInDays',
    policies: null,
    label: 'Invite link expiry',
    range: '1–30 days',
  })
  expect(entry.source).toBe('plugin_default')
  expect(entry.value).toBe(2) // plugin default 48h = 2 days
  expect(entry.defaultValue).toBe(2)
})

test('resolveWorkspaceEntry treats a null field as unset (plugin default applies)', () => {
  // A field set to null in the jsonb means "unconfigured" — the plugin's
  // own default applies. This is what "Restore to default" does on S-13.1.
  const policies: WorkspacePolicies = {
    ...PLUGIN_DEFAULTS,
    membershipLimit: null,
  }
  const entry = resolveWorkspaceEntry({
    key: 'membershipLimit',
    policies,
    label: 'Max members per workspace',
    range: '1–500',
  })
  expect(entry.source).toBe('plugin_default')
  expect(entry.value).toBeNull()
})

test('resolveEnvironmentEntry always reports "environment" source', () => {
  // Env-set values are read-only on S-13.1. The source is always
  // 'environment', regardless of whether the env var is at its default.
  const entry = resolveEnvironmentEntry({
    key: 'totpIssuer',
    envValue: 'Abugida Academy',
    defaultValue: 'Abugida Academy',
    label: 'TOTP issuer',
    range: 'Any string',
  })
  expect(entry.source).toBe('environment')
  expect(entry.value).toBe('Abugida Academy')
  expect(entry.defaultValue).toBe('Abugida Academy')
})

test('resolveEnvironmentEntry can show an env override that differs from the default', () => {
  // When the env var is set to a non-default value, S-13.1 shows both so the
  // admin can see "this is set by environment, not by the workspace".
  const entry = resolveEnvironmentEntry({
    key: 'accountLockoutMaxAttempts',
    envValue: 3,
    defaultValue: 5,
    label: 'Lock out after',
    range: '3–10 attempts',
  })
  expect(entry.value).toBe(3)
  expect(entry.defaultValue).toBe(5)
})

test('formatSessionTimeout renders the spec values', () => {
  expect(formatSessionTimeout(15)).toBe('15 min')
  expect(formatSessionTimeout(60)).toBe('1 hour')
  expect(formatSessionTimeout(480)).toBe('8 hours')
  expect(formatSessionTimeout(1440)).toBe('1 day')
  expect(formatSessionTimeout(10080)).toBe('7 days')
  expect(formatSessionTimeout(null)).toBeNull()
})

test('the workspace + environment entries together cover every spec-13 policy', () => {
  // 9 workspace-configurable + 5 env-overridable = 14 total, matching the
  // spec's configurable-values table.
  expect(WORKSPACE_CONFIG_FIELDS.length + ENV_POLICY_KEYS.length).toBe(14)
})
