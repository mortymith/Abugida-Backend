/**
 * Server-only implementation of S-6.8 Security & Audit Log. Policies persist
 * in system_configs (category 'security'); the audit trail reads the
 * append-only audit_logs table with actor/action filters and server-side
 * pagination, exporting CSV through a bounded generation loop.
 * Never import from client code.
 */
import { and, count, desc, eq, or, sql } from '@abugida/database'
import { auditLogs } from '@abugida/database/ops'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  readConfigKeys,
  requireSettingsAdmin,
  upsertConfigKey,
  writeAudit,
} from './settings.server-helpers.server'
import { authServerConfigSummary } from './settings.provider-config.server'
import type { AuditLogPage, SecurityPolicies } from '../settings.types'
import type { AuditLogQuery, SaveSecurityPoliciesInput } from '../schemas/settings.schema'

const POLICY_KEY = 'security.policies'

interface StoredPolicies {
  requireAdminMfa?: boolean
  sessionTimeoutHours?: number | null
  allowedIpRanges?: string[]
}

const AUDIT_PAGE_SIZE = 25
const AUDIT_ACTIONS = [
  'user_login',
  'user_logout',
  'purchase_completed',
  'lesson_access',
  'admin_action',
  'data_export',
  'permission_change',
  'content_moderation',
  'grade_modified',
  'enrollment_status_changed',
  'bundle_purchased',
] as const

export async function getSecurityPoliciesImpl(): Promise<SecurityPolicies> {
  await requireSettingsAdmin()

  const stored = (await readConfigKeys([POLICY_KEY]))[POLICY_KEY] as StoredPolicies | undefined

  return {
    requireAdminMfa: stored?.requireAdminMfa ?? false,
    sessionTimeoutHours: stored?.sessionTimeoutHours ?? null,
    allowedIpRanges: stored?.allowedIpRanges ?? [],
    signInMethods: authServerConfigSummary(),
    availability: 'ok',
  }
}

export async function saveSecurityPoliciesImpl(
  input: SaveSecurityPoliciesInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await upsertConfigKey({
    key: POLICY_KEY,
    value: {
      requireAdminMfa: input.requireAdminMfa,
      sessionTimeoutHours: input.sessionTimeoutHours,
      allowedIpRanges: input.allowedIpRanges,
    } satisfies StoredPolicies,
    category: 'security',
    description: 'Workspace security policy: MFA enforcement, session timeout, IP ranges (S-6.8)',
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.8',
      action: 'save_security_policies',
      requireAdminMfa: input.requireAdminMfa,
      sessionTimeoutHours: input.sessionTimeoutHours,
      ipRangeCount: input.allowedIpRanges.length,
    },
  })
  return { ok: true }
}

type AuditWhere = ReturnType<typeof and>

function buildAuditWhere(query: AuditLogQuery): AuditWhere {
  const filters = []
  if (query.actor) {
    const escaped = query.actor.replace(/[%_\\]/g, (match) => `\\${match}`)
    const pattern = `%${escaped}%`
    filters.push(
      or(
        eq(auditLogs.actorId, query.actor),
        sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${auditLogs.actorId}
            AND (${users.name} ILIKE ${pattern} OR ${users.email} ILIKE ${pattern}))`,
      ),
    )
  }
  const isValidAction = (AUDIT_ACTIONS as readonly string[]).includes(query.action ?? '')
  if (query.action && isValidAction) {
    filters.push(eq(auditLogs.action, query.action as (typeof AUDIT_ACTIONS)[number]))
  }
  return filters.length ? and(...filters) : undefined
}

const actorNameSql = sql<
  string | null
>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${auditLogs.actorId})`
const actorEmailSql = sql<
  string | null
>`(SELECT ${users.email} FROM ${users} WHERE ${users.id} = ${auditLogs.actorId})`

export async function getAuditLogImpl(query: AuditLogQuery): Promise<AuditLogPage> {
  await requireSettingsAdmin()

  const where = buildAuditWhere(query)
  const page = query.page ?? 1

  const [rows, totals] = await Promise.all([
    db
      .select({
        publicId: auditLogs.publicId,
        action: auditLogs.action,
        actorName: actorNameSql,
        actorEmail: actorEmailSql,
        resourceType: auditLogs.resourceType,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.actorIp,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
  ])

  const total = Number(totals.at(0)?.total ?? 0)

  return {
    items: rows.map((row) => {
      const metadata = (row.metadata ?? {}) as {
        action?: string | null
        description?: string | null
      }
      return {
        publicId: row.publicId,
        action: metadata.action ?? row.action ?? 'admin_action',
        actorName: row.actorName ?? null,
        actorEmail: row.actorEmail ?? null,
        resourceType: row.resourceType ?? null,
        resourceDescription: metadata.description ?? null,
        ipAddress: row.ipAddress ?? null,
        createdAt: row.createdAt.toISOString(),
      }
    }),
    page,
    pageSize: AUDIT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Spec: export routes through the S-5.4-style generation flow (CSV here).
 * Bounded to 50 pages per run; admins narrow with actor/action filters first.
 */
export async function exportAuditLogCsvImpl(
  query: AuditLogQuery,
): Promise<{ fileName: string; csv: string }> {
  const adminId = await requireSettingsAdmin()

  const header = 'timestamp,actor,actor_email,action,resource_type,description,ip'
  const lines: string[] = []
  const maxPages = 50

  for (let page = 1; page <= maxPages; page++) {
    const entry = await getAuditLogImpl({ ...query, page })
    for (const item of entry.items) {
      lines.push(
        [
          item.createdAt,
          item.actorName ?? '',
          item.actorEmail ?? '',
          item.action,
          item.resourceType ?? '',
          item.resourceDescription ?? '',
          item.ipAddress ?? '',
        ]
          .map((cell) => csvEscape(cell))
          .join(','),
      )
    }
    if (page >= entry.totalPages || entry.items.length === 0) break
  }

  await writeAudit({
    actorId: adminId,
    action: 'data_export',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.8', action: 'export_audit_log_csv', rows: lines.length },
  })

  return {
    fileName: `abugida-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: [header, ...lines].join('\n'),
  }
}
