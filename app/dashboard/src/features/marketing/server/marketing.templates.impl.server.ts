/**
 * Server-only implementation of S-8.2 Email Template Editor: the pre-built
 * library, draft editing with autosave, versioned publishes (campaigns pin
 * the version they used), merge-tag validation against the known tag list,
 * usage counts, and test sends to the operator's own address. Never import
 * from client code.
 */
import { and, count, desc, eq, isNull, sql } from '@abugida/database'
import {
  emailTemplateVersions,
  emailTemplates,
  templateDocumentSchema,
  campaigns,
} from '@abugida/database/marketing'
import type { TemplateDocument } from '@abugida/database/marketing'
import { db } from '#/config/db.config'
import {
  enqueueEmails,
  requireMarketingReadRole,
  requireMarketingWriteRole,
  writeMarketingAudit,
} from './marketing.server-helpers.server'
import { renderTemplateDocument } from '../marketing.email-render'
import { validateMergeTags } from '../marketing.merge-tags'
import type { TemplatePublicIdInput, TemplateSaveInput } from '../schemas/marketing.schema'
import type { TemplateDetail, TemplateListRow } from '../marketing.types'

/** Spec S-8.2 pre-built library — each entry starts a new editable copy. */
export const PREBUILT_TEMPLATES: Array<{
  key: string
  name: string
  kind:
    'welcome' | 'announcement' | 'reminder' | 'promotion' | 'certificate_issued' | 're_engagement'
  subject: string
  preheader: string
  blocks: TemplateDocument['blocks']
}> = [
  {
    key: 'welcome',
    name: 'Welcome',
    kind: 'welcome',
    subject: 'Welcome to Abugida Academy, {{first_name}}!',
    preheader: 'Your learning journey starts here.',
    blocks: [
      {
        type: 'hero',
        heading: 'Welcome aboard, {{first_name}}!',
        subheading: 'We are glad you are here.',
      },
      {
        type: 'text',
        body: 'Your account is ready. Explore your dashboard to see your courses and progress.',
      },
      { type: 'button', label: 'Open my dashboard', url: '{{progress_url}}' },
    ],
  },
  {
    key: 'announcement',
    name: 'Course Announcement',
    kind: 'announcement',
    subject: '{{course_name}} starts {{start_date}} — save your seat',
    preheader: 'Seats are limited for the new cohort.',
    blocks: [
      { type: 'hero', heading: '{{course_name}} is starting', subheading: 'Begins {{start_date}}' },
      {
        type: 'text',
        body: 'Hi {{first_name}},\n\nOur next {{course_name}} cohort begins {{start_date}}. Reserve your seat before it fills up.',
      },
      { type: 'course_card', coursePublicId: null },
      { type: 'button', label: 'View syllabus', url: '{{progress_url}}' },
    ],
  },
  {
    key: 'reminder',
    name: 'Lesson Reminder',
    kind: 'reminder',
    subject: 'Keep going, {{first_name}} — your next lesson awaits',
    preheader: 'A gentle nudge on your learning streak.',
    blocks: [
      { type: 'hero', heading: 'Your next lesson is ready' },
      {
        type: 'text',
        body: 'Hi {{first_name}},\n\nPick up where you left off in {{course_name}} — a few focused minutes is all it takes.',
      },
      { type: 'button', label: 'Continue learning', url: '{{progress_url}}' },
    ],
  },
  {
    key: 'promotion',
    name: 'Promotion',
    kind: 'promotion',
    subject: 'A special offer for {{first_name}}',
    preheader: 'Limited-time savings on selected courses.',
    blocks: [
      { type: 'hero', heading: 'Limited-time offer', subheading: 'Save on selected courses' },
      {
        type: 'text',
        body: 'Hi {{first_name}},\n\nFor a short time you can join {{course_name}} at a special price. Use your offer at checkout.',
      },
      { type: 'button', label: 'Claim the offer', url: '{{progress_url}}' },
    ],
  },
  {
    key: 'certificate_issued',
    name: 'Certificate Issued',
    kind: 'certificate_issued',
    subject: 'Your {{course_name}} certificate is ready',
    preheader: 'Congratulations on finishing the course!',
    blocks: [
      { type: 'hero', heading: 'Congratulations, {{first_name}}!' },
      {
        type: 'text',
        body: 'You completed {{course_name}}. Your certificate is available now — download and share it.',
      },
      { type: 'button', label: 'Get my certificate', url: '{{progress_url}}' },
    ],
  },
  {
    key: 're_engagement',
    name: 'Re-engagement',
    kind: 're_engagement',
    subject: 'We miss you at Abugida Academy',
    preheader: 'Your progress is saved — jump back in.',
    blocks: [
      { type: 'hero', heading: 'Pick up right where you left off' },
      {
        type: 'text',
        body: 'Hi {{first_name}},\n\nIt has been a while. Your {{course_name}} progress is saved and waiting.',
      },
      { type: 'button', label: 'Resume my course', url: '{{progress_url}}' },
    ],
  },
]

function documentFromInput(input: TemplateSaveInput): TemplateDocument {
  return templateDocumentSchema.parse({
    blocks: input.document.blocks,
    footer: { type: 'footer' },
  })
}

/** Merge-tag issues across subject, preheader, and every text block. */
export function templateTagIssues(input: TemplateSaveInput) {
  return validateMergeTags([
    input.subject,
    input.preheader ?? null,
    ...input.document.blocks.flatMap((block) => {
      if (block.type === 'hero') return [block.heading, block.subheading ?? null]
      if (block.type === 'text') return [block.body]
      if (block.type === 'button') return [block.label]
      return []
    }),
  ])
}

export async function listTemplatesImpl(): Promise<{ items: TemplateListRow[] }> {
  await requireMarketingReadRole()

  const rows = await db
    .select({
      publicId: emailTemplates.publicId,
      name: emailTemplates.name,
      kind: emailTemplates.kind,
      currentVersion: emailTemplates.currentVersion,
      draftSubject: emailTemplates.draftSubject,
      updatedAt: emailTemplates.updatedAt,
      usageCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${campaigns}
        WHERE ${campaigns.templateId} = ${emailTemplates.id}
      )`,
    })
    .from(emailTemplates)
    .where(isNull(emailTemplates.deletedAt))
    .orderBy(desc(emailTemplates.updatedAt))
    .limit(100)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      name: row.name,
      kind: row.kind,
      currentVersion: row.currentVersion,
      subject: row.draftSubject,
      usageCount: Number(row.usageCount),
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}

export async function getTemplateImpl(input: TemplatePublicIdInput): Promise<TemplateDetail> {
  await requireMarketingReadRole()

  const rows = await db
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.publicId, input.templatePublicId), isNull(emailTemplates.deletedAt)),
    )
    .limit(1)
  const template = rows.at(0)
  if (!template) throw new Error('TEMPLATE_NOT_FOUND')

  const [versionRows, usageRows] = await Promise.all([
    db
      .select({
        version: emailTemplateVersions.version,
        subject: emailTemplateVersions.subject,
        publishedAt: emailTemplateVersions.publishedAt,
      })
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.templateId, template.id))
      .orderBy(desc(emailTemplateVersions.version))
      .limit(20),
    db.select({ total: count() }).from(campaigns).where(eq(campaigns.templateId, template.id)),
  ])

  return {
    publicId: template.publicId,
    name: template.name,
    kind: template.kind,
    currentVersion: template.currentVersion,
    subject: template.draftSubject,
    usageCount: Number(usageRows.at(0)?.total ?? 0),
    updatedAt: template.updatedAt.toISOString(),
    preheader: template.draftPreheader,
    document: template.draftDocument,
    versions: versionRows.map((row) => ({
      version: row.version,
      subject: row.subject,
      publishedAt: row.publishedAt.toISOString(),
    })),
  }
}

export async function saveTemplateImpl(input: TemplateSaveInput): Promise<{
  templatePublicId: string
  version: number | null
  tagIssues: ReturnType<typeof templateTagIssues>
}> {
  const userId = await requireMarketingWriteRole()

  // Drafts may carry unresolved tags (the editor highlights them live);
  // publishing below re-checks and blocks with a suggestion-driven error.
  const issues = templateTagIssues(input)

  const document = documentFromInput(input)

  let publicId = input.templatePublicId ?? null
  if (publicId == null) {
    const inserted = await db
      .insert(emailTemplates)
      .values({
        name: input.name,
        kind: input.kind,
        draftDocument: document,
        draftSubject: input.subject,
        draftPreheader: input.preheader ?? null,
        createdBy: userId,
      })
      .returning({ publicId: emailTemplates.publicId, id: emailTemplates.id })
    const created = inserted.at(0)
    if (!created) throw new Error('TEMPLATE_CREATE_FAILED')
    publicId = created.publicId
  } else {
    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(and(eq(emailTemplates.publicId, publicId), isNull(emailTemplates.deletedAt)))
      .limit(1)
    const row = existing.at(0)
    if (!row) throw new Error('TEMPLATE_NOT_FOUND')

    await db
      .update(emailTemplates)
      .set({
        name: input.name,
        kind: input.kind,
        draftDocument: document,
        draftSubject: input.subject,
        draftPreheader: input.preheader ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, row.id))
  }

  let publishedVersion: number | null = null
  if (input.publish) {
    if (issues.length > 0) {
      throw new Error(
        `MERGE_TAG_INVALID:${issues.map((issue) => issue.tag).join(', ')} — use the suggestion list`,
      )
    }
    publishedVersion = await publishVersion(publicId, input, document, userId)
  }

  return { templatePublicId: publicId, version: publishedVersion, tagIssues: issues }
}

async function publishVersion(
  templatePublicId: string,
  input: TemplateSaveInput,
  document: TemplateDocument,
  userId: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: emailTemplates.id, currentVersion: emailTemplates.currentVersion })
      .from(emailTemplates)
      .where(eq(emailTemplates.publicId, templatePublicId))
      .limit(1)
    const template = rows.at(0)
    if (!template) throw new Error('TEMPLATE_NOT_FOUND')

    const nextVersion = template.currentVersion + 1
    await tx.insert(emailTemplateVersions).values({
      templateId: template.id,
      version: nextVersion,
      subject: input.subject,
      preheader: input.preheader ?? null,
      document,
      publishedBy: userId,
    })
    await tx
      .update(emailTemplates)
      .set({ currentVersion: nextVersion, updatedAt: new Date() })
      .where(eq(emailTemplates.id, template.id))
    return nextVersion
  })
}

export async function getPrebuiltLibraryImpl(): Promise<
  Array<{ key: string; name: string; kind: string; subject: string }>
> {
  await requireMarketingReadRole()
  return PREBUILT_TEMPLATES.map((template) => ({
    key: template.key,
    name: template.name,
    kind: template.kind,
    subject: template.subject,
  }))
}

/**
 * Start a new template copy from a pre-built entry (S-8.2 "each starts a new
 * copy") — the pre-built definitions themselves are never edited.
 */
export async function createFromPrebuiltImpl(input: {
  key: string
}): Promise<{ templatePublicId: string }> {
  const userId = await requireMarketingWriteRole()
  const prebuilt = PREBUILT_TEMPLATES.find((template) => template.key === input.key)
  if (!prebuilt) throw new Error('PREBUILT_NOT_FOUND')

  const document = templateDocumentSchema.parse({
    blocks: prebuilt.blocks,
    footer: { type: 'footer' },
  })

  const inserted = await db
    .insert(emailTemplates)
    .values({
      name: `${prebuilt.name} template`,
      kind: prebuilt.kind,
      draftDocument: document,
      draftSubject: prebuilt.subject,
      draftPreheader: prebuilt.preheader,
      createdBy: userId,
    })
    .returning({ publicId: emailTemplates.publicId })

  const publicId = inserted.at(0)?.publicId
  if (!publicId) throw new Error('TEMPLATE_CREATE_FAILED')

  return { templatePublicId: publicId }
}

/** Preview sample with chosen or pseudo-random student data (no PII leaves). */
export async function getPreviewSampleImpl(): Promise<{
  sample: { firstName: string; courseName: string; startDate: string }
}> {
  await requireMarketingReadRole()
  return {
    sample: {
      firstName: 'Alemayehu',
      courseName: 'TOEFL Complete',
      startDate: 'March 2',
    },
  }
}

export async function sendTestTemplateImpl(input: TemplatePublicIdInput): Promise<{ ok: true }> {
  await requireMarketingWriteRole()
  const { requireCallerEmail } = await import('./marketing.server-helpers.server')

  const rows = await db
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.publicId, input.templatePublicId), isNull(emailTemplates.deletedAt)),
    )
    .limit(1)
  const template = rows.at(0)
  if (!template) throw new Error('TEMPLATE_NOT_FOUND')
  if (!template.draftDocument || !template.draftSubject) {
    throw new Error('TEMPLATE_EMPTY:Add a subject and at least one block first')
  }

  if (template.draftSubject) {
    const issues = validateMergeTags([template.draftSubject])
    if (issues.length > 0) {
      throw new Error(`MERGE_TAG_INVALID:${issues.map((issue) => issue.tag).join(', ')}`)
    }
  }

  const me = await requireCallerEmail()
  const firstName = me.name.split(/\s+/)[0] ?? me.name
  const rendered = renderTemplateDocument(template.draftDocument, {
    first_name: firstName,
    email: me.email,
    course_name: 'TOEFL Complete (sample)',
    start_date: 'Monday',
    progress_url: 'https://abugida.app/dashboard',
    unsubscribe_url: `https://abugida.app/unsubscribe?email=${encodeURIComponent(me.email)}`,
  })

  await enqueueEmails([
    {
      recipientEmail: me.email,
      subject: `[Test] ${template.draftSubject}`,
      htmlBody: rendered.html,
      idempotencyKey: `test-template:${me.email}:${template.publicId}:${Date.now()}`,
    },
  ])

  await writeMarketingAudit({
    actorId: me.id,
    entity: 'email_template',
    action: 'test_send',
    entityPublicId: template.publicId,
  })

  return { ok: true }
}
