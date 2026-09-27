/**
 * Server-only implementation of S-8.1 Email Campaigns: campaign list and
 * detail (delivered → opened → clicked → enrolled funnel plus link-level
 * clicks), the draft → scheduled → sending → sent lifecycle with server
 * validated transitions, consent-aware audience sends through the queue
 * transport, test sends, duplication, and scheduled-send cancellation.
 * Never import from client code.
 */
import { and, count, desc, eq, inArray, isNull, sql } from '@abugida/database'
import {
  campaigns,
  campaignSends,
  campaignEvents,
  emailTemplateVersions,
  emailTemplates,
} from '@abugida/database/marketing'
import { cohorts, enrollments } from '@abugida/database/learning'
import { courses } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireMarketingReadRole,
  requireMarketingWriteRole,
  writeMarketingAudit,
  enqueueEmails,
} from './marketing.server-helpers.server'
import {
  resolveAudienceRecipients,
  previewAudienceImpl as resolveAudiencePreview,
} from './marketing.audience.impl.server'
import { renderTemplateDocument } from '../marketing.email-render'
import {
  assertTransition,
  describeAudience,
  isDuplicatable,
  isMetricsUpdating,
} from '../marketing.campaign-states'
import type {
  CampaignCreateInput,
  CampaignPublicIdInput,
  CampaignScheduleInput,
  CampaignSendTestInput,
  CampaignUpdateInput,
} from '../schemas/marketing.schema'
import type {
  CampaignDetail,
  CampaignRow,
  CampaignStatusValue,
  TemplateBlockView,
} from '../marketing.types'
import type { CampaignAudience } from '@abugida/database/marketing'

async function resolveCampaign(campaignPublicId: string) {
  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.publicId, campaignPublicId))
    .limit(1)
  const campaign = rows.at(0)
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND')
  return campaign
}

/** Resolve the pinned template document: pinned version, else draft fields. */
async function resolveTemplateContent(
  templateId: number | null,
  templateVersionId: number | null,
): Promise<{
  templatePublicId: string | null
  templateName: string | null
  document: { blocks: TemplateBlockView[] } | null
  subject: string | null
  preheader: string | null
}> {
  if (templateVersionId != null) {
    const rows = await db
      .select({
        version: emailTemplateVersions,
        templatePublicId: emailTemplates.publicId,
        templateName: emailTemplates.name,
      })
      .from(emailTemplateVersions)
      .innerJoin(emailTemplates, eq(emailTemplates.id, emailTemplateVersions.templateId))
      .where(eq(emailTemplateVersions.id, templateVersionId))
      .limit(1)
    const row = rows.at(0)
    if (row) {
      return {
        templatePublicId: row.templatePublicId,
        templateName: row.templateName,
        document: row.version.document,
        subject: row.version.subject,
        preheader: row.version.preheader,
      }
    }
  }
  if (templateId != null) {
    const rows = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1)
    const template = rows.at(0)
    if (template) {
      return {
        templatePublicId: template.publicId,
        templateName: template.name,
        document: template.draftDocument,
        subject: template.draftSubject,
        preheader: template.draftPreheader,
      }
    }
  }
  return {
    templatePublicId: null,
    templateName: null,
    document: null,
    subject: null,
    preheader: null,
  }
}

export async function getCampaignsImpl(query: { status: string }): Promise<{
  items: CampaignRow[]
}> {
  await requireMarketingReadRole()

  const rows = await db
    .select({
      publicId: campaigns.publicId,
      name: campaigns.name,
      subject: campaigns.subject,
      preheader: campaigns.preheader,
      status: campaigns.status,
      audience: campaigns.audience,
      scheduledFor: campaigns.scheduledFor,
      sentAt: campaigns.sentAt,
      recipientCount: campaigns.recipientCount,
      createdAt: campaigns.createdAt,
      templatePublicId: emailTemplates.publicId,
      templateName: emailTemplates.name,
    })
    .from(campaigns)
    .leftJoin(emailTemplates, eq(emailTemplates.id, campaigns.templateId))
    .where(
      query.status !== 'all'
        ? eq(campaigns.status, query.status as CampaignStatusValue)
        : undefined,
    )
    .orderBy(desc(campaigns.createdAt))
    .limit(100)

  // One grouped pass for link-in rates across all listed campaigns.
  const publicIds = rows.map((row) => row.publicId)
  const eventAgg =
    publicIds.length > 0
      ? await db
          .select({
            campaignId: campaigns.id,
            eventType: campaignEvents.eventType,
            recipients: sql<number>`COUNT(DISTINCT ${campaignEvents.email})::int`,
          })
          .from(campaignEvents)
          .innerJoin(campaigns, eq(campaigns.id, campaignEvents.campaignId))
          .where(inArray(campaigns.publicId, publicIds))
          .groupBy(campaigns.id, campaignEvents.eventType)
      : []

  const sendsAgg =
    publicIds.length > 0
      ? await db
          .select({
            campaignId: campaigns.id,
            sent: sql<number>`COUNT(*) FILTER (WHERE ${campaignSends.status} = 'sent')::int`,
            total: sql<number>`COUNT(*)::int`,
          })
          .from(campaignSends)
          .innerJoin(campaigns, eq(campaigns.id, campaignSends.campaignId))
          .where(inArray(campaigns.publicId, publicIds))
          .groupBy(campaigns.id)
      : []

  const aggByPublicId = new Map<
    string,
    { opens: number; clicks: number; sent: number; total: number }
  >()
  for (const row of eventAgg) {
    const key = String(row.campaignId)
    const entry = aggByPublicId.get(key) ?? { opens: 0, clicks: 0, sent: 0, total: 0 }
    if (row.eventType === 'opened') entry.opens = Number(row.recipients)
    if (row.eventType === 'clicked') entry.clicks = Number(row.recipients)
    aggByPublicId.set(key, entry)
  }
  for (const row of sendsAgg) {
    const key = String(row.campaignId)
    const entry = aggByPublicId.get(key) ?? { opens: 0, clicks: 0, sent: 0, total: 0 }
    entry.sent = Number(row.sent)
    entry.total = Number(row.total)
    aggByPublicId.set(key, entry)
  }
  // Map publicId → internal id so the aggregates above can be joined back.
  const idByPublicId = new Map<string, number>()
  if (publicIds.length > 0) {
    const internalIds = await db
      .select({ publicId: campaigns.publicId, id: campaigns.id })
      .from(campaigns)
      .where(inArray(campaigns.publicId, publicIds))
    for (const row of internalIds) idByPublicId.set(row.publicId, row.id)
  }

  return {
    items: rows.map((row) => {
      const agg = aggByPublicId.get(String(idByPublicId.get(row.publicId) ?? ''))
      const denominator = agg && agg.total > 0 ? agg.total : (row.recipientCount ?? 0)
      const updating = isMetricsUpdating(row.sentAt?.toISOString() ?? null)
      return {
        publicId: row.publicId,
        name: row.name,
        subject: row.subject,
        preheader: row.preheader,
        status: row.status,
        audience: row.audience,
        audienceLabel: describeAudience(row.audience),
        templatePublicId: row.templatePublicId,
        templateName: row.templateName,
        scheduledFor: row.scheduledFor?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        recipientCount: row.recipientCount,
        openRate:
          updating || denominator === 0 || agg == null
            ? null
            : Math.round((agg.opens / denominator) * 100),
        clickRate:
          updating || denominator === 0 || agg == null
            ? null
            : Math.round((agg.clicks / denominator) * 100),
        createdAt: row.createdAt.toISOString(),
      }
    }),
  }
}

export async function getCampaignImpl(input: CampaignPublicIdInput): Promise<CampaignDetail> {
  await requireMarketingReadRole()
  const campaign = await resolveCampaign(input.campaignPublicId)

  // Funnel aggregates — database-side, one pass per metric family.
  const [sendCounts, eventCounts, linkCounts, enrollmentRows] = await Promise.all([
    db
      .select({ status: campaignSends.status, total: count() })
      .from(campaignSends)
      .where(eq(campaignSends.campaignId, campaign.id))
      .groupBy(campaignSends.status),
    db
      .select({
        eventType: campaignEvents.eventType,
        recipients: sql<number>`COUNT(DISTINCT ${campaignEvents.email})::int`,
      })
      .from(campaignEvents)
      .where(eq(campaignEvents.campaignId, campaign.id))
      .groupBy(campaignEvents.eventType),
    db
      .select({
        label: sql<string>`COALESCE(${campaignEvents.linkLabel}, ${campaignEvents.linkUrl})`,
        url: campaignEvents.linkUrl,
        clicks: sql<number>`COUNT(*)::int`,
      })
      .from(campaignEvents)
      .where(
        and(eq(campaignEvents.campaignId, campaign.id), eq(campaignEvents.eventType, 'clicked')),
      )
      .groupBy(campaignEvents.linkLabel, campaignEvents.linkUrl)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10),
    // Attributed enrollments: purchases by recipients after the send fired.
    campaign.sentAt
      ? db
          .select({ total: sql<number>`COUNT(*)::int` })
          .from(enrollments)
          .innerJoin(
            campaignSends,
            and(
              eq(campaignSends.campaignId, campaign.id),
              eq(campaignSends.userId, enrollments.studentId),
            ),
          )
          .where(
            and(
              eq(enrollments.enrollmentSource, 'purchase'),
              isNull(enrollments.deletedAt),
              sql`${enrollments.createdAt} >= ${campaign.sentAt}`,
            ),
          )
      : Promise.resolve([{ total: 0 }]),
  ])

  const recipients = sendCounts.reduce((sum, row) => sum + Number(row.total), 0)
  const deliveredEvents = Number(
    eventCounts.find((row) => row.eventType === 'delivered')?.recipients ?? 0,
  )
  const opened = Number(eventCounts.find((row) => row.eventType === 'opened')?.recipients ?? 0)
  const clicked = Number(eventCounts.find((row) => row.eventType === 'clicked')?.recipients ?? 0)
  const sentCount = Number(sendCounts.find((row) => row.status === 'sent')?.total ?? 0)

  const updating = isMetricsUpdating(campaign.sentAt?.toISOString() ?? null)

  const template = await resolveTemplateContent(campaign.templateId, campaign.templateVersionId)

  return {
    publicId: campaign.publicId,
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader,
    status: campaign.status,
    audience: campaign.audience,
    audienceLabel: describeAudience(campaign.audience),
    templatePublicId: template.templatePublicId,
    templateName: template.templateName,
    scheduledFor: campaign.scheduledFor?.toISOString() ?? null,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    recipientCount: campaign.recipientCount,
    createdAt: campaign.createdAt.toISOString(),
    funnel: {
      recipients,
      // No provider webhook yet: transport-accepted sends stand in for
      // delivery; open/click stay null while the metrics-update window runs.
      delivered: deliveredEvents > 0 ? deliveredEvents : sentCount,
      opened: updating && opened === 0 ? null : opened,
      clicked: updating && clicked === 0 ? null : clicked,
      enrollments: Number(Array.isArray(enrollmentRows) ? (enrollmentRows[0]?.total ?? 0) : 0),
      metricsUpdating: updating,
    },
    linkClicks: linkCounts
      .filter((row): row is typeof row & { url: string } => row.url != null)
      .map((row) => ({
        label: row.label,
        url: row.url,
        clicks: row.clicks,
      })),
    openRate: null,
    clickRate: null,
  }
}

async function buildRecipientEmails(
  campaign: { subject: string; preheader: string | null },
  audience: CampaignAudience,
  templateVersionId: number | null,
  templateId: number | null,
): Promise<Array<{ userId: string; email: string; html: string; idempotencyKey: string }>> {
  const recipients = await resolveAudienceRecipients(audience)
  const template = await resolveTemplateContent(templateId, templateVersionId)
  if (!template.document || blocksOf(template.document).length === 0) {
    throw new Error('TEMPLATE_EMPTY:Pick a template with content before sending')
  }

  return recipients.map((recipient) => {
    const firstName = recipient.name.split(/\s+/)[0] ?? recipient.name
    const html = renderTemplateDocument(template.document, {
      first_name: firstName,
      last_name: recipient.name.split(/\s+/).slice(1).join(' '),
      email: recipient.email,
      unsubscribe_url: `https://abugida.app/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
    }).html
    return {
      userId: recipient.userId,
      email: recipient.email,
      html,
      idempotencyKey: `${recipient.email}:${campaign.subject}`,
    }
  })
}

function blocksOf(document: unknown): Array<Record<string, unknown>> {
  const doc = document as { blocks?: Array<Record<string, unknown>> } | null
  return doc?.blocks ?? []
}

export async function createCampaignImpl(
  input: CampaignCreateInput,
): Promise<{ campaignPublicId: string }> {
  const userId = await requireMarketingWriteRole()

  let templateId: number | null = null
  if (input.templatePublicId) {
    const rows = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.publicId, input.templatePublicId), isNull(emailTemplates.deletedAt)),
      )
      .limit(1)
    templateId = rows.at(0)?.id ?? null
    if (templateId == null) throw new Error('TEMPLATE_NOT_FOUND')
  }

  const inserted = await db
    .insert(campaigns)
    .values({
      name: input.name,
      subject: input.subject,
      preheader: input.preheader ?? null,
      templateId,
      audience: input.audience,
      status: 'draft',
      createdBy: userId,
    })
    .returning({ publicId: campaigns.publicId })

  const campaignPublicId = inserted.at(0)?.publicId
  if (!campaignPublicId) throw new Error('CAMPAIGN_CREATE_FAILED')

  await writeMarketingAudit({
    actorId: userId,
    entity: 'campaign',
    action: 'create',
    entityPublicId: campaignPublicId,
  })

  return { campaignPublicId }
}

export async function updateCampaignImpl(input: CampaignUpdateInput): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const campaign = await resolveCampaign(input.campaignPublicId)
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    throw new Error('CAMPAIGN_LOCKED:Only draft or scheduled campaigns can be edited')
  }

  let templateId: number | null | undefined
  if (input.templatePublicId !== undefined) {
    if (input.templatePublicId === null) {
      templateId = null
    } else {
      const rows = await db
        .select({ id: emailTemplates.id })
        .from(emailTemplates)
        .where(eq(emailTemplates.publicId, input.templatePublicId))
        .limit(1)
      templateId = rows.at(0)?.id ?? null
      if (templateId == null) throw new Error('TEMPLATE_NOT_FOUND')
    }
  }

  await db
    .update(campaigns)
    .set({
      name: input.name,
      subject: input.subject,
      preheader: input.preheader ?? null,
      ...(templateId !== undefined ? { templateId } : {}),
      audience: input.audience,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id))

  await writeMarketingAudit({
    actorId: userId,
    entity: 'campaign',
    action: 'update',
    entityPublicId: campaign.publicId,
  })

  return { ok: true }
}

export async function scheduleCampaignImpl(input: CampaignScheduleInput): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const campaign = await resolveCampaign(input.campaignPublicId)
  const scheduledFor = new Date(input.scheduledFor)
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
    throw new Error('INVALID_SCHEDULE:Pick a future date and time')
  }

  if (campaign.status === 'scheduled') {
    // Rescheduling an already-scheduled campaign is an update, not a state
    // change; cancelling first is required to leave `scheduled`.
    await db
      .update(campaigns)
      .set({ scheduledFor, updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id))
    return { ok: true }
  }

  assertTransition(campaign.status, 'scheduled')
  await db
    .update(campaigns)
    .set({ status: 'scheduled', scheduledFor, updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id))

  await writeMarketingAudit({
    actorId: userId,
    entity: 'campaign',
    action: 'schedule',
    entityPublicId: campaign.publicId,
    metadata: { scheduledFor: scheduledFor.toISOString() },
  })
  return { ok: true }
}

export async function cancelScheduledCampaignImpl(
  input: CampaignPublicIdInput,
): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const campaign = await resolveCampaign(input.campaignPublicId)
  assertTransition(campaign.status, 'cancelled')

  await db
    .update(campaigns)
    .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id))

  await writeMarketingAudit({
    actorId: userId,
    entity: 'campaign',
    action: 'cancel',
    entityPublicId: campaign.publicId,
  })
  return { ok: true }
}

export async function duplicateCampaignImpl(
  input: CampaignPublicIdInput,
): Promise<{ campaignPublicId: string }> {
  const userId = await requireMarketingWriteRole()
  const campaign = await resolveCampaign(input.campaignPublicId)
  if (!isDuplicatable(campaign.status)) {
    throw new Error('CAMPAIGN_BUSY:Only settled campaigns can be duplicated')
  }

  const inserted = await db
    .insert(campaigns)
    .values({
      name: `${campaign.name} (copy)`,
      subject: campaign.subject,
      preheader: campaign.preheader,
      templateId: campaign.templateId,
      audience: campaign.audience,
      status: 'draft',
      duplicatedFromId: campaign.id,
      createdBy: userId,
    })
    .returning({ publicId: campaigns.publicId })

  const newPublicId = inserted.at(0)?.publicId
  if (!newPublicId) throw new Error('CAMPAIGN_CREATE_FAILED')

  await writeMarketingAudit({
    actorId: userId,
    entity: 'campaign',
    action: 'duplicate',
    entityPublicId: newPublicId,
    metadata: { sourcePublicId: campaign.publicId },
  })
  return { campaignPublicId: newPublicId }
}

export async function previewAudienceImpl(input: { audience: CampaignAudience }): Promise<{
  count: number
  matched: number
  sample: Array<{ id: string; name: string; email: string }>
}> {
  await requireMarketingReadRole()
  return resolveAudiencePreview(input.audience)
}

/**
 * Send pipeline. The S-7.1 confirmation for large sends happens in the UI
 * with the exact count from previewAudience — the server always recomputes
 * the deliverable audience and never trusts client numbers.
 */
export async function sendCampaignNowImpl(input: CampaignPublicIdInput): Promise<{
  recipientCount: number
}> {
  const userId = await requireMarketingWriteRole()
  const campaign = await resolveCampaign(input.campaignPublicId)
  assertTransition(campaign.status, 'sending')

  const emails = await buildRecipientEmails(
    { subject: campaign.subject, preheader: campaign.preheader },
    campaign.audience,
    campaign.templateVersionId,
    campaign.templateId,
  )
  if (emails.length === 0) {
    throw new Error(
      'SEGMENT_EMPTY:This audience matches 0 recipients — adjust filters before sending',
    )
  }

  // Recipient snapshot rows (idempotent per campaign+email).
  await db
    .insert(campaignSends)
    .values(
      emails.map((email) => ({
        campaignId: campaign.id,
        userId: email.userId,
        email: email.email,
        status: 'queued' as const,
      })),
    )
    .onConflictDoNothing()

  // Transport hand-off via the queue package (EMAIL_NOTIFICATION jobs).
  await enqueueEmails(
    emails.map((email) => ({
      recipientEmail: email.email,
      subject: campaign.subject,
      htmlBody: email.html,
      idempotencyKey: `${campaign.publicId}:${email.email}`,
    })),
  )

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(campaignSends)
      .set({ status: 'sent', sentAt: now })
      .where(and(eq(campaignSends.campaignId, campaign.id), eq(campaignSends.status, 'queued')))
    await tx
      .update(campaigns)
      .set({ status: 'sent', sentAt: now, recipientCount: emails.length, updatedAt: now })
      .where(eq(campaigns.id, campaign.id))
  })

  await writeMarketingAudit({
    actorId: userId,
    entity: 'campaign',
    action: 'send',
    entityPublicId: campaign.publicId,
    metadata: { recipientCount: emails.length },
  })

  return { recipientCount: emails.length }
}

export async function sendTestCampaignImpl(input: CampaignSendTestInput): Promise<{ ok: true }> {
  await requireMarketingWriteRole()
  const { requireCallerEmail } = await import('./marketing.server-helpers.server')

  const target = input.campaignPublicId ? await resolveCampaign(input.campaignPublicId) : null

  const templateId = target?.templateId ?? null
  const templateVersionId = target?.templateVersionId ?? null

  let templateRow: {
    document: Parameters<typeof renderTemplateDocument>[0]
    subject: string
    preheader: string | null
  } | null = null

  if (input.templatePublicId) {
    const rows = await db
      .select()
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.publicId, input.templatePublicId), isNull(emailTemplates.deletedAt)),
      )
      .limit(1)
    const template = rows.at(0)
    if (template?.draftDocument && template.draftSubject) {
      templateRow = {
        document: template.draftDocument,
        subject: template.draftSubject,
        preheader: template.draftPreheader,
      }
    }
  } else if (target) {
    const resolved = await resolveTemplateContent(templateId, templateVersionId)
    if (resolved.document) {
      templateRow = {
        document: resolved.document,
        subject: target.subject,
        preheader: target.preheader,
      }
    }
  }

  if (!templateRow) throw new Error('TEMPLATE_EMPTY:Nothing to send yet — add template content')
  if (blocksOf(templateRow.document).length === 0) {
    throw new Error('TEMPLATE_EMPTY:Nothing to send yet — add template content')
  }

  const me = await requireCallerEmail()
  const firstName = me.name.split(/\s+/)[0] ?? me.name
  const html = renderTemplateDocument(templateRow.document, {
    first_name: firstName,
    email: me.email,
    course_name: 'TOEFL Complete (sample)',
    start_date: 'Monday',
    progress_url: 'https://abugida.app/dashboard',
    unsubscribe_url: `https://abugida.app/unsubscribe?email=${encodeURIComponent(me.email)}`,
  }).html

  await enqueueEmails([
    {
      recipientEmail: me.email,
      subject: `[Test] ${templateRow.subject}`,
      htmlBody: html,
      idempotencyKey: `test:${me.email}:${templateRow.subject}:${Date.now()}`,
    },
  ])

  return { ok: true }
}

/** Composer reference data: templates, cohorts, courses, tags for filters. */
export async function getComposerReferenceImpl(): Promise<{
  templates: Array<{ publicId: string; name: string; kind: string; currentVersion: number }>
  cohorts: Array<{ publicId: string; name: string }>
  courses: Array<{ publicId: string; title: string }>
}> {
  await requireMarketingReadRole()

  const [templateRows, cohortRows, courseRows] = await Promise.all([
    db
      .select({
        publicId: emailTemplates.publicId,
        name: emailTemplates.name,
        kind: emailTemplates.kind,
        currentVersion: emailTemplates.currentVersion,
      })
      .from(emailTemplates)
      .where(isNull(emailTemplates.deletedAt))
      .orderBy(desc(emailTemplates.updatedAt))
      .limit(100),
    db
      .select({ publicId: cohorts.publicId, name: cohorts.name })
      .from(cohorts)
      .where(isNull(cohorts.deletedAt))
      .orderBy(desc(cohorts.createdAt))
      .limit(100),
    db
      .select({ publicId: courses.publicId, title: courses.title })
      .from(courses)
      .where(and(isNull(courses.deletedAt), eq(courses.status, 'published')))
      .orderBy(courses.title)
      .limit(200),
  ])

  return {
    templates: templateRows,
    cohorts: cohortRows,
    courses: courseRows,
  }
}

/** Scheduled-campaign scan — used by tests and future automation. */
export async function listDueScheduledImpl(): Promise<Array<{ publicId: string }>> {
  const rows = await db
    .select({ publicId: campaigns.publicId })
    .from(campaigns)
    .where(and(eq(campaigns.status, 'scheduled'), sql`${campaigns.scheduledFor} <= NOW()`))
    .limit(50)
  return rows
}

/** Guard used by tests: userIds resolved for a segment (server-side only). */
export async function resolveSegmentUserIds(audience: CampaignAudience): Promise<string[]> {
  const recipients = await resolveAudienceRecipients(audience)
  const ids = recipients.map((recipient) => recipient.userId)
  if (ids.length > 0) {
    const rows = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids))
    return rows.map((row) => row.id)
  }
  return ids
}
