/**
 * Server-only helpers shared by the Marketing & Growth impl modules (spec
 * 10): role requirements per the spec 11 matrix, marketing configuration
 * storage, audit trail, and email enqueueing through the queue package.
 * Never import from client code.
 */
import { eq } from '@abugida/database'
import { auditLogs, systemConfigs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { env } from '#/config/app.config'
import { getRequest } from '@tanstack/react-start/server'
import {
  getSessionRole,
  requireUserId,
} from '#/features/students/server/students.server-helpers.server'
import { ROLE_PRIORITY } from '#/features/auth/auth.roles'
import type { PlatformRole } from '#/features/auth/auth.roles'

// ── Role gates (spec 11 matrix: Marketing & Growth row) ─────────────────────

/** View: Admin/Editor full; Reviewer/Viewer/Support view-only. */
export async function requireMarketingReadRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (!hasStaffRole(role)) throw new Error('FORBIDDEN')
  return userId
}

/** Author/send/manage: Admin and Editor only (Support "no send"). */
export async function requireMarketingWriteRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (role !== 'admin' && role !== 'editor') throw new Error('FORBIDDEN')
  return userId
}

/** Payout runs and affiliate program settings: Admin only. */
export async function requirePayoutAdminRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (role !== 'admin') throw new Error('FORBIDDEN')
  return userId
}

/** Testimonial moderation queue: Admin, Editor, or Support (S-8.5). */
export async function requireModerationRole(): Promise<string> {
  const userId = await requireUserId()
  const role = await getSessionRole()
  if (role !== 'admin' && role !== 'editor' && role !== 'support') throw new Error('FORBIDDEN')
  return userId
}

function hasStaffRole(role: PlatformRole): boolean {
  // Every platform role is a staff role for marketing reads (spec 11 row).
  return ROLE_PRIORITY[role] > 0
}

// ── Marketing configuration (system_configs, settings-adjacent values) ──────

export const AFFILIATE_PROGRAM_CONFIG_KEY = 'marketing.affiliate_program'
export const TESTIMONIAL_SETTINGS_CONFIG_KEY = 'marketing.testimonial_triggers'

export interface AffiliateProgramConfig {
  commissionPercent: number
  cookieWindowDays: number
  payoutThreshold: number
  payoutMethod: string
}

export const DEFAULT_AFFILIATE_PROGRAM: AffiliateProgramConfig = {
  commissionPercent: 20,
  cookieWindowDays: 30,
  payoutThreshold: 50,
  payoutMethod: 'bank_transfer',
}

export interface TestimonialSettingsConfig {
  onCompletion: boolean
  onFiveStar: boolean
  displayFormat: 'carousel' | 'grid' | 'highlight'
}

export const DEFAULT_TESTIMONIAL_SETTINGS: TestimonialSettingsConfig = {
  onCompletion: true,
  onFiveStar: true,
  displayFormat: 'carousel',
}

export async function readMarketingConfig<T>(key: string, fallback: T): Promise<T> {
  const rows = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1)
  const row = rows.at(0)
  if (!row?.value) return fallback
  return { ...fallback, ...row.value }
}

export async function writeMarketingConfig(
  key: string,
  value: unknown,
  description: string,
): Promise<void> {
  await db
    .insert(systemConfigs)
    .values({ key, value: value, category: 'marketing', description })
    .onConflictDoUpdate({
      target: systemConfigs.key,
      set: { value: value, category: 'marketing', updatedAt: new Date() },
    })
}

// ── Audit trail (revenue-sensitive actions) ─────────────────────────────────

export async function writeMarketingAudit(input: {
  actorId: string
  entity:
    | 'campaign'
    | 'email_template'
    | 'coupon'
    | 'affiliate'
    | 'payout'
    | 'testimonial'
    | 'affiliate_program'
  action: string
  entityPublicId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: 'admin_action',
    metadata: {
      domain: 'marketing',
      entity: input.entity,
      marketingAction: input.action,
      entityPublicId: input.entityPublicId ?? null,
      ...(input.metadata ?? {}),
    },
  })
}

// ── Email enqueueing (S-6.3 integration → queue EMAIL_NOTIFICATION) ────────

export interface QueuedEmail {
  recipientEmail: string
  subject: string
  htmlBody: string
  templateId?: string
  idempotencyKey: string
}

/**
 * Enqueue email jobs through the shared queue package (BullMQ transport).
 * The email provider integration (S-6.3) is the transport; the dashboard
 * orchestrates sends but is never the transport itself.
 */
export async function enqueueEmails(emails: QueuedEmail[]): Promise<void> {
  if (emails.length === 0) return
  const { getTanStackQueueClient } = await import('@abugida/queue/tanstack')
  const { JobType, mergeWithDefaults } = await import('@abugida/queue')
  const config = mergeWithDefaults({
    redis: {
      hostname: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
    },
  })
  const queue = getTanStackQueueClient(config)
  await queue.enqueueBulk(
    emails.map((email) => ({
      jobType: JobType.EMAIL_NOTIFICATION,
      data: {
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        htmlBody: email.htmlBody,
        ...(email.templateId != null ? { templateId: email.templateId } : {}),
        idempotencyKey: email.idempotencyKey,
      },
    })),
  )
}

// ── Session helper for test sends ───────────────────────────────────────────

/** Resolve the caller's own email for "Send Test" (S-8.1/S-8.2). */
export async function requireCallerEmail(): Promise<{ id: string; email: string; name: string }> {
  const userId = await requireUserId()
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return {
    id: userId,
    email: session.value.user.email,
    name: session.value.user.name ?? 'Abugida',
  }
}
