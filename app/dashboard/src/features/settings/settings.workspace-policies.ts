/**
 * Spec 13 § Configuration Surface — workspace policy defaults + provenance.
 *
 * Pure module: no DB, no env, no framework. Safe to import from server code,
 * client code, and `bun test`. The server impl in
 * `courses.workspace-config.impl.server.ts` calls these functions to resolve
 * the effective value + provenance for each policy, and the S-13.1 view
 * imports the types so it can render the provenance pill without a second
 * round-trip.
 *
 * The runtime precedence (§ Configuration Surface):
 *
 *   workspace policy > plugin config > plugin default
 *
 * Env-overridable values (TOTP_ISSUER, TWO_FACTOR_COOKIE_MAX_AGE,
 * TRUST_DEVICE_MAX_AGE, ACCOUNT_LOCKOUT_*) are read-only on S-13.1 and
 * reported as `source: 'environment'`. They cannot be changed from the UI.
 *
 * "Unconfigured" means the plugin's own default applies and nobody has
 * decided it for this product. Those rows are the implementation gaps this
 * part closes; showing them on S-13.1 is how a gap becomes visible instead
 * of silent.
 */
import type { WorkspacePolicies } from '@abugida/database/auth'

/**
 * The plugin's own defaults, taken from Better Auth's `organization()` plugin
 * source. These apply when neither the workspace nor the env has set a value.
 *
 * Spec 13 § Configurable values table — the "Default now" column. Rows marked
 * "Unconfigured" in the spec are represented here as the value the plugin
 * silently falls back to, so S-13.1 can show "plugin default: X" rather than
 * a blank field.
 */
export const PLUGIN_DEFAULTS = {
  membershipLimit: null, // unlimited
  invitationLimit: null, // unlimited
  /** Plugin default 48h, expressed in days for the workspace-configurable surface. */
  invitationExpiresInDays: 2,
  organizationLimit: 1,
  cancelPendingInvitationsOnReInvite: false,
  allowUserToCreateOrganization: true,
  requireMfaFor: 'no_one' as const,
  /** The plugin does not configure session timeout; the dashboard's session plugin does. */
  sessionTimeoutMinutes: null,
  sessionRevocationOnRoleChange: false,
} satisfies WorkspacePolicies

/**
 * The env-overridable policy keys. These are read from `env` (resolved from
 * `process.env` by the server impl) and reported as `source: 'environment'`
 * on S-13.1. They are never writable from the UI; the spec calls this out
 * explicitly: "security-sensitive values are env-only".
 */
export const ENV_POLICY_KEYS = [
  'totpIssuer',
  'twoFactorCookieMaxAge',
  'trustDeviceMaxAge',
  'accountLockoutMaxAttempts',
  'accountLockoutDurationSeconds',
] as const

export type EnvPolicyKey = (typeof ENV_POLICY_KEYS)[number]

/**
 * The serializable primitive a policy value can hold. Tanstack Start's
 * `createServerFn` requires serializable return types; `unknown` would
 * reject. Every policy value is a number, a boolean, a string enum, or null.
 */
export type WorkspacePolicyValue = string | number | boolean | null

/**
 * The policies the S-13.1 surface shows. Each entry carries the resolved
 * value, where it came from, and the default it would fall back to.
 */
export interface WorkspaceConfigEntry {
  /** The policy key, matching `WorkspacePolicies` or `EnvPolicyKey`. */
  key: string
  /** The resolved value the workspace operates under. */
  value: WorkspacePolicyValue
  /**
   * Where the value came from:
   *  - 'workspace' — set by an admin on this organization's policies jsonb
   *  - 'plugin_default' — unset; the plugin's own default applies
   *  - 'environment' — set by env var; read-only on S-13.1
   */
  source: 'workspace' | 'plugin_default' | 'environment'
  /**
   * The default the value would fall back to when unset. Shown alongside the
   * current value when they differ: "7 days (plugin default: 2 days)".
   */
  defaultValue: WorkspacePolicyValue
  /** Human-readable label for the field. */
  label: string
  /** The range or accepted values, for inline validation on the UI. */
  range?: string
}

export interface WorkspaceConfigResult {
  /** The workspace-configurable policies. */
  workspace: WorkspaceConfigEntry[]
  /** The env-overridable policies (read-only on S-13.1). */
  environment: WorkspaceConfigEntry[]
  /** The organization's id + name, for the screen header. */
  organizationId: string
  organizationName: string
}

/**
 * Resolve one workspace-configurable policy entry.
 *
 * The precedence is: workspace policy > plugin default. (Env does not apply
 * to workspace-configurable keys; env keys are resolved separately.)
 *
 * Pure: takes the workspace policies + the key + the default, returns the
 * entry. The server impl reads the jsonb and passes it in.
 */
export function resolveWorkspaceEntry(input: {
  key: keyof WorkspacePolicies
  policies: WorkspacePolicies | null
  label: string
  range?: string
}): WorkspaceConfigEntry {
  const workspaceValue = input.policies?.[input.key] ?? null
  const defaultValue = PLUGIN_DEFAULTS[input.key]
  if (workspaceValue !== null) {
    return {
      key: input.key,
      value: workspaceValue,
      source: 'workspace',
      defaultValue: defaultValue,
      label: input.label,
      range: input.range,
    }
  }
  return {
    key: input.key,
    value: defaultValue,
    source: 'plugin_default',
    defaultValue: defaultValue,
    label: input.label,
    range: input.range,
  }
}

/**
 * Resolve one env-overridable policy entry. The value is always the env value
 * (or the default if the env var is unset); the source is always
 * 'environment'. S-13.1 renders these read-only with a reason.
 */
export function resolveEnvironmentEntry(input: {
  key: string
  envValue: WorkspacePolicyValue
  defaultValue: WorkspacePolicyValue
  label: string
  range?: string
}): WorkspaceConfigEntry {
  return {
    key: input.key,
    value: input.envValue,
    source: 'environment',
    defaultValue: input.defaultValue,
    label: input.label,
    range: input.range,
  }
}

/**
 * The full set of workspace-configurable entries, in the order S-13.1 renders
 * them. Used by the server impl to iterate the policies jsonb without
 * duplicating the labels and ranges in two places.
 */
export const WORKSPACE_CONFIG_FIELDS: Array<{
  key: keyof WorkspacePolicies
  label: string
  range: string
}> = [
  { key: 'membershipLimit', label: 'Max members per workspace', range: '1–500' },
  {
    key: 'allowUserToCreateOrganization',
    label: 'Allow members to create workspaces',
    range: 'on / off',
  },
  { key: 'organizationLimit', label: 'Max workspaces per user', range: '1–20' },
  { key: 'invitationExpiresInDays', label: 'Invite link expiry', range: '1–30 days' },
  { key: 'invitationLimit', label: 'Max pending invitations', range: '0–200' },
  {
    key: 'cancelPendingInvitationsOnReInvite',
    label: 'Re-inviting replaces the previous link',
    range: 'on / off',
  },
  {
    key: 'requireMfaFor',
    label: 'Require two-factor for',
    range: 'Everyone / Editors+Reviewers / No one',
  },
  { key: 'sessionTimeoutMinutes', label: 'Session timeout', range: '15m / 1h / 8h / 24h / 7d' },
  {
    key: 'sessionRevocationOnRoleChange',
    label: 'Session revocation on role change',
    range: 'on / off',
  },
]

/**
 * The accepted session-timeout values, in minutes. S-13.1's dropdown offers
 * exactly these; the spec's "15 m / 1 h / 8 h / 24 h / 7 d" row.
 */
export const SESSION_TIMEOUT_OPTIONS_MINUTES = [15, 60, 480, 1440, 10080] as const

/**
 * The accepted MFA-required audiences. S-13.1's radio group offers exactly
 * these; the spec's "Everyone / Editors+Reviewers / No one" row.
 */
export const MFA_REQUIRED_OPTIONS = ['everyone', 'editors+reviewers', 'no_one'] as const

/**
 * Human-readable labels for the MFA audiences.
 */
export const MFA_REQUIRED_LABELS: Record<(typeof MFA_REQUIRED_OPTIONS)[number], string> = {
  everyone: 'Everyone',
  'editors+reviewers': 'Editors + Reviewers',
  no_one: 'No one',
}

/**
 * Format a session-timeout value (in minutes) for display. Returns null for
 * unrecognised values so the UI can fall back to the raw number.
 */
export function formatSessionTimeout(minutes: number | null): string | null {
  if (minutes === null) return null
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${minutes / 60} hour${minutes / 60 === 1 ? '' : 's'}`
  if (minutes < 10080) return `${minutes / 1440} day${minutes / 1440 === 1 ? '' : 's'}`
  return '7 days'
}
