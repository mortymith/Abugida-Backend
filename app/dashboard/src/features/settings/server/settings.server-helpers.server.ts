/**
 * Server-only helpers shared by the Settings feature impl modules (spec 08):
 * role requirements per the spec 11 matrix (all workspace settings screens
 * are Admin-only; S-6.5 profile is own-record for every role), system config
 * read/upsert helpers, audit logging, and org resolution. Never import from
 * client code.
 */
import { eq, inArray, sql } from '@abugida/database'
import { member, organization } from '@abugida/database/auth'
import { auditLogs, systemConfigs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'

/** Any authenticated platform user (S-6.5 profile is own-record for all roles). */
export async function requireUserId(): Promise<string> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return session.value.user.id
}

/**
 * Map raw member roles to an admin flag (owner/admin → admin) without
 * importing the whole role-resolution stack — settings only needs the
 * admin boundary.
 */
async function isAdmin(userId: string): Promise<boolean> {
  const rows = await db.select({ role: member.role }).from(member).where(eq(member.userId, userId))
  for (const row of rows) {
    for (const part of row.role.split(',')) {
      const name = part.trim().toLowerCase()
      if (name === 'owner' || name === 'admin') return true
    }
  }
  return false
}

/**
 * Spec 11 matrix: every workspace-settings screen (S-6.1..S-6.4, S-6.6..S-6.10)
 * is Admin-only. Client nav gating is UX; this is the security boundary.
 */
export async function requireSettingsAdmin(): Promise<string> {
  const userId = await requireUserId()
  if (!(await isAdmin(userId))) throw new Error('FORBIDDEN')
  return userId
}

/** Authenticated user for profile reads/writes (own record only). */
export async function requireProfileUser(): Promise<string> {
  return requireUserId()
}

// ── System configs (spec's system_settings tables map here) ─────────────────

/** Read config keys into a typed map. Missing keys are absent from the result. */
export async function readConfigKeys(keys: string[]): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {}
  const rows = await db
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, keys))
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

/**
 * Upsert one config key. `isEncrypted` marks credential values — they are
 * stored for the integration layer but never returned to clients (write-only).
 */
export async function upsertConfigKey(input: {
  key: string
  value: unknown
  category: string
  description?: string
  isEncrypted?: boolean
}): Promise<void> {
  await db
    .insert(systemConfigs)
    .values({
      key: input.key,
      value: input.value,
      category: input.category,
      description: input.description ?? null,
      isEncrypted: input.isEncrypted ?? false,
    })
    .onConflictDoUpdate({
      target: systemConfigs.key,
      set: {
        value: input.value,
        category: input.category,
        isEncrypted: input.isEncrypted ?? false,
        updatedAt: new Date(),
      },
    })
}

// ── Audit trail (S-6.8) ──────────────────────────────────────────────────────

/** Append-only audit entry (spec: every sensitive settings action is audited). */
export async function writeAudit(input: {
  actorId: string
  action:
    | 'user_login'
    | 'user_logout'
    | 'admin_action'
    | 'data_export'
    | 'permission_change'
    | 'enrollment_status_changed'
  resourceType:
    | 'course'
    | 'enrollment'
    | 'user_account'
    | 'role_assignment'
    | 'quiz_attempt'
    | 'lesson'
    | 'module'
    | 'purchase'
    | 'bundle'
  metadata: Record<string, unknown>
}): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    metadata: input.metadata,
  })
}

// ── Organization resolution ──────────────────────────────────────────────────

/**
 * Resolve the caller's workspace (Better Auth organization). The dashboard is
 * single-org per workspace; the first membership wins. Null when the user has
 * no org membership yet.
 */
export async function resolveCallerOrganization(
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .limit(1)
  return rows.at(0) ?? null
}

/** Org member count per mapped platform role — feeds S-6.9 conflict checks. */
export async function countMembersByRole(organizationId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ role: member.role, count: sql<number>`COUNT(*)::int` })
    .from(member)
    .where(eq(member.organizationId, organizationId))
    .groupBy(member.role)
  const counts: Record<string, number> = {}
  for (const row of rows) {
    // A member row can hold a comma-separated role list (Better Auth format);
    // count it under each role it grants.
    for (const part of row.role.split(',')) {
      const name = part.trim().toLowerCase()
      if (!name) continue
      counts[name] = (counts[name] ?? 0) + Number(row.count)
    }
  }
  return counts
}

/** Whether the org still has another admin/owner besides `excludeMemberId`. */
export async function hasOtherAdmin(
  organizationId: string,
  excludeMemberId: string,
): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(member)
    .where(
      sql`${member.organizationId} = ${organizationId}
          AND ${member.id} <> ${excludeMemberId}
          AND (${member.role} LIKE '%admin%' OR ${member.role} LIKE '%owner%')`,
    )
  return Number(rows.at(0)?.count ?? 0) > 0
}
