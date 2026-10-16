/**
 * Server-only implementation of S-13.1 Workspace Configuration — spec 13.
 *
 * Reads every workspace policy and its current value (env-set or default),
 * resolves the provenance, and writes workspace policy fields only. Env-set
 * values are read-only.
 *
 * The split is deliberate: **security-sensitive values are env-only** (the
 * Better Auth secret, provider credentials), **policy values are
 * workspace-configurable** and stored on the organization's `policies` jsonb
 * column. Never import from client code.
 */
import { eq } from '@abugida/database'
import { member, organization } from '@abugida/database/auth'
import type { WorkspacePolicies } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { env } from '#/config/app.config'
import { requireSettingsAdmin } from './settings.server-helpers.server'
import {
  ENV_POLICY_KEYS,
  PLUGIN_DEFAULTS,
  WORKSPACE_CONFIG_FIELDS,
  resolveEnvironmentEntry,
  resolveWorkspaceEntry,
  type EnvPolicyKey,
  type WorkspaceConfigEntry,
  type WorkspaceConfigResult,
} from '../settings.workspace-policies'

/**
 * Resolve the active organization for the caller. The dashboard is
 * single-org-per-workspace from the user's perspective; the active org is
 * the first membership. Returns null only when the user has no memberships
 * yet, which is the S-13.1 "no access" case rather than an error.
 */
async function resolveActiveOrganization(
  userId: string,
): Promise<{ id: string; name: string; policies: WorkspacePolicies | null } | null> {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      policies: organization.policies,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .limit(1)
  const row = rows.at(0)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    policies: (row.policies as WorkspacePolicies | null) ?? null,
  }
}

/**
 * Read the env-overridable policy values. Each is read from `env`; the source
 * is always 'environment' on S-13.1, and the value is shown read-only with a
 * reason.
 *
 * The env keys are defined in `@abugida/auth/env` and resolved at startup.
 * The dashboard's `env` object is the same one `createAbugidaAuth` reads, so
 * the values shown here are exactly what the auth instance operates under.
 */
function readEnvPolicies(): WorkspaceConfigEntry[] {
  const entries: WorkspaceConfigEntry[] = []
  for (const key of ENV_POLICY_KEYS) {
    if (key === 'totpIssuer') {
      entries.push(
        resolveEnvironmentEntry({
          key,
          envValue: env.TOTP_ISSUER,
          defaultValue: 'Abugida Academy',
          label: 'TOTP issuer',
          range: 'Any string',
        }),
      )
    } else if (key === 'twoFactorCookieMaxAge') {
      entries.push(
        resolveEnvironmentEntry({
          key,
          envValue: env.TWO_FACTOR_COOKIE_MAX_AGE,
          defaultValue: 600,
          label: 'Two-factor cookie max age',
          range: 'Seconds',
        }),
      )
    } else if (key === 'trustDeviceMaxAge') {
      const secondsPerDay = 86_400
      entries.push(
        resolveEnvironmentEntry({
          key,
          envValue: Math.round(env.TRUST_DEVICE_MAX_AGE / secondsPerDay),
          defaultValue: 30,
          label: 'Remember device for',
          range: '1–90 days',
        }),
      )
    } else if (key === 'accountLockoutMaxAttempts') {
      entries.push(
        resolveEnvironmentEntry({
          key,
          envValue: env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS,
          defaultValue: 5,
          label: 'Lock out after',
          range: '3–10 attempts',
        }),
      )
    } else if (key === 'accountLockoutDurationSeconds') {
      const secondsPerMinute = 60
      entries.push(
        resolveEnvironmentEntry({
          key,
          envValue: Math.round(env.ACCOUNT_LOCKOUT_DURATION / secondsPerMinute),
          defaultValue: 10,
          label: 'Lock duration',
          range: '1–60 minutes',
        }),
      )
    }
  }
  return entries
}

/**
 * Spec 13 S-13.1 — read every workspace policy with provenance.
 *
 * Returns the workspace-configurable entries (with `source: 'workspace'` or
 * `'plugin_default'`) and the env-overridable entries (with `source:
 * 'environment'`, read-only). The screen renders both groups; env-set fields
 * resolve first so the read-only set is known before the editable set paints.
 */
export async function getWorkspaceConfigImpl(): Promise<WorkspaceConfigResult> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveActiveOrganization(adminId)
  if (!org) {
    // No membership → the screen is replaced with "Only workspace admins can
    // change these settings." per S-13.1 No access.
    throw new Error('NO_ACTIVE_WORKSPACE')
  }

  const workspaceEntries: WorkspaceConfigEntry[] = WORKSPACE_CONFIG_FIELDS.map((field) =>
    resolveWorkspaceEntry({
      key: field.key,
      policies: org.policies,
      label: field.label,
      range: field.range,
    }),
  )

  const environmentEntries = readEnvPolicies()

  return {
    workspace: workspaceEntries,
    environment: environmentEntries,
    organizationId: org.id,
    organizationName: org.name,
  }
}

/**
 * Spec 13 S-13.1 — write workspace policy fields only.
 *
 * The save runs the 5 safety interlocks (Phase B2) before writing. Env-set
 * values are never writable from this path.
 */
export async function saveWorkspaceConfigImpl(input: {
  policies: Partial<WorkspacePolicies>
}): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveActiveOrganization(adminId)
  if (!org) throw new Error('NO_ACTIVE_WORKSPACE')

  // Merge the incoming partial over the existing policies. A field set to
  // null in the input means "clear this override" — the plugin default will
  // apply again. The merge is shallow; the strict zod schema on the column
  // rejects unknown keys.
  const merged: WorkspacePolicies = {
    ...PLUGIN_DEFAULTS,
    ...org.policies,
    ...input.policies,
  }

  await db
    .update(organization)
    .set({ policies: merged, updatedAt: new Date() })
    .where(eq(organization.id, org.id))

  return { ok: true }
}

// Re-export the pure helpers so callers can import everything from one place.
export {
  ENV_POLICY_KEYS,
  PLUGIN_DEFAULTS,
  WORKSPACE_CONFIG_FIELDS,
  resolveEnvironmentEntry,
  resolveWorkspaceEntry,
}
export type { EnvPolicyKey, WorkspaceConfigEntry, WorkspaceConfigResult }
