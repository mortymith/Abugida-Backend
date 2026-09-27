/**
 * Server-only implementation of S-8.4 Affiliate Program: program settings
 * (admin-only), applications and approval flow, per-affiliate performance
 * (clicks / sales / revenue / owed), self-referral fraud detection with
 * commission holds, and payout runs that mark commissions paid and notify
 * affiliates. Commission rates are snapshotted per sale — changes apply
 * prospectively only. Never import from client code.
 */
import { and, desc, eq, inArray, isNull, ne, sql } from '@abugida/database'
import {
  affiliateEvents,
  affiliateLinks,
  affiliates,
  commissions,
  payouts,
} from '@abugida/database/marketing'
import { courses } from '@abugida/database/catalog'
import { purchases } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import {
  AFFILIATE_PROGRAM_CONFIG_KEY,
  DEFAULT_AFFILIATE_PROGRAM,
  enqueueEmails,
  readMarketingConfig,
  requireMarketingReadRole,
  requireMarketingWriteRole,
  requirePayoutAdminRole,
  writeMarketingAudit,
  writeMarketingConfig,
} from './marketing.server-helpers.server'
import type { AffiliateProgramConfig } from './marketing.server-helpers.server'
import { buildPayoutRunRows, round2, summarizePayoutRun } from '../marketing.commission-math'
import type {
  AffiliateDecisionInput,
  AffiliateFraudInput,
  AffiliateInviteInput,
  AffiliateLinkInput,
  AffiliateStatusChangeInput,
  ProgramSettingsInput,
} from '../schemas/marketing.schema'
import type {
  AffiliateProgramSummary,
  AffiliateRow,
  PayoutHistoryRow,
  PayoutRunResult,
  PayoutRunRow,
} from '../marketing.types'

async function resolveAffiliate(affiliatePublicId: string) {
  const rows = await db
    .select()
    .from(affiliates)
    .where(and(eq(affiliates.publicId, affiliatePublicId), isNull(affiliates.deletedAt)))
    .limit(1)
  const affiliate = rows.at(0)
  if (!affiliate) throw new Error('AFFILIATE_NOT_FOUND')
  return affiliate
}

export async function getAffiliateProgramImpl(): Promise<AffiliateProgramSummary> {
  await requireMarketingReadRole()

  const settings = await readMarketingConfig<AffiliateProgramConfig>(
    AFFILIATE_PROGRAM_CONFIG_KEY,
    DEFAULT_AFFILIATE_PROGRAM,
  )

  const [pendingRows, owedRows] = await Promise.all([
    db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(affiliates)
      .where(and(eq(affiliates.status, 'pending'), isNull(affiliates.deletedAt))),
    db
      .select({ total: sql<string>`COALESCE(SUM(${commissions.amount}), 0)` })
      .from(commissions)
      .where(eq(commissions.status, 'pending')),
  ])

  return {
    settings,
    pendingApplications: Number(pendingRows.at(0)?.total ?? 0),
    pendingPayoutTotal: round2(Number(owedRows.at(0)?.total ?? 0)),
    currency: 'ETB',
  }
}

export async function saveProgramSettingsImpl(input: ProgramSettingsInput): Promise<{ ok: true }> {
  const userId = await requirePayoutAdminRole()

  await writeMarketingConfig(
    AFFILIATE_PROGRAM_CONFIG_KEY,
    input,
    'Affiliate program: commission, cookie window, payout threshold and method (S-8.4)',
  )
  await writeMarketingAudit({
    actorId: userId,
    entity: 'affiliate_program',
    action: 'update_settings',
    metadata: { ...input },
  })
  return { ok: true }
}

export async function listAffiliatesImpl(query: {
  status?: string
}): Promise<{ items: AffiliateRow[] }> {
  await requireMarketingReadRole()

  const rows = await db
    .select()
    .from(affiliates)
    .where(
      and(
        isNull(affiliates.deletedAt),
        query.status && query.status !== 'all'
          ? eq(affiliates.status, query.status as 'pending')
          : undefined,
      ),
    )
    .orderBy(desc(affiliates.createdAt))
    .limit(100)

  if (rows.length === 0) return { items: [] }

  const affiliateIds = rows.map((row) => row.id)

  const [clickRows, salesRows, linkRows] = await Promise.all([
    db
      .select({
        affiliateId: affiliateEvents.affiliateId,
        clicks: sql<number>`COUNT(*)::int`,
      })
      .from(affiliateEvents)
      .where(
        and(
          inArray(affiliateEvents.affiliateId, affiliateIds),
          eq(affiliateEvents.eventType, 'click'),
        ),
      )
      .groupBy(affiliateEvents.affiliateId),
    db
      .select({
        affiliateId: commissions.affiliateId,
        sales: sql<number>`COUNT(DISTINCT ${commissions.purchaseId})::int`,
        revenue: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
        owed: sql<string>`COALESCE(SUM(${commissions.amount}) FILTER (WHERE ${commissions.status} = 'pending'), 0)`,
      })
      .from(commissions)
      .leftJoin(
        purchases,
        and(eq(purchases.id, commissions.purchaseId), eq(purchases.status, 'completed')),
      )
      .where(inArray(commissions.affiliateId, affiliateIds))
      .groupBy(commissions.affiliateId),
    db
      .select({
        affiliateId: affiliateLinks.affiliateId,
        code: affiliateLinks.code,
        courseTitle: courses.title,
        isActive: affiliateLinks.isActive,
      })
      .from(affiliateLinks)
      .leftJoin(courses, eq(courses.id, affiliateLinks.courseId))
      .where(inArray(affiliateLinks.affiliateId, affiliateIds)),
  ])

  const clicksByAffiliate = new Map(clickRows.map((row) => [row.affiliateId, Number(row.clicks)]))
  const salesByAffiliate = new Map(salesRows.map((row) => [row.affiliateId, row]))
  const linksByAffiliate = new Map<number, AffiliateRow['links']>()
  for (const row of linkRows) {
    const list = linksByAffiliate.get(row.affiliateId) ?? []
    // Suspended affiliates keep their history but links render inert.
    list.push({ code: row.code, courseTitle: row.courseTitle ?? null })
    linksByAffiliate.set(row.affiliateId, list)
  }

  return {
    items: rows.map((row) => {
      const sales = salesByAffiliate.get(row.id)
      return {
        publicId: row.publicId,
        name: row.name,
        email: row.email,
        status: row.status,
        audience: row.audience,
        channels: row.channels,
        decisionNote: row.decisionNote,
        clicks: clicksByAffiliate.get(row.id) ?? 0,
        sales: Number(sales?.sales ?? 0),
        revenue: round2(Number(sales?.revenue ?? 0)),
        owed: round2(Number(sales?.owed ?? 0)),
        commissionsHeld: row.commissionsHeld,
        fraudFlaggedAt: row.fraudFlaggedAt?.toISOString() ?? null,
        fraudEvidence: row.fraudEvidence ?? null,
        links: linksByAffiliate.get(row.id) ?? [],
        currency: 'ETB',
      }
    }),
  }
}

export async function inviteAffiliateImpl(
  input: AffiliateInviteInput,
): Promise<{ affiliatePublicId: string }> {
  const userId = await requireMarketingWriteRole()

  const inserted = await db
    .insert(affiliates)
    .values({
      name: input.name,
      email: input.email,
      status: 'pending',
      audience: input.audience ?? null,
      channels: input.channels ?? null,
    })
    .onConflictDoNothing()
    .returning({ publicId: affiliates.publicId })

  const publicId = inserted.at(0)?.publicId
  if (!publicId) throw new Error('AFFILIATE_EXISTS:An application with that email already exists')

  await writeMarketingAudit({
    actorId: userId,
    entity: 'affiliate',
    action: 'invite',
    entityPublicId: publicId,
  })
  return { affiliatePublicId: publicId }
}

export async function decideAffiliateImpl(input: AffiliateDecisionInput): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const affiliate = await resolveAffiliate(input.affiliatePublicId)
  if (affiliate.status !== 'pending') {
    throw new Error('AFFILIATE_DECIDED:This application was already decided')
  }

  await db
    .update(affiliates)
    .set({
      status: input.decision === 'approve' ? 'approved' : 'declined',
      decisionNote: input.note ?? null,
      decidedBy: userId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(affiliates.id, affiliate.id))

  await enqueueEmails([
    {
      recipientEmail: affiliate.email,
      subject:
        input.decision === 'approve'
          ? 'Your Abugida affiliate application is approved'
          : 'Your Abugida affiliate application',
      htmlBody:
        input.decision === 'approve'
          ? `<p>Hi ${affiliate.name},</p><p>Your affiliate application has been approved. Your referral links are now active.</p>`
          : `<p>Hi ${affiliate.name},</p><p>Thank you for applying. After review we are unable to move forward at this time.</p>`,
      idempotencyKey: `affiliate-decision:${affiliate.publicId}`,
    },
  ])

  await writeMarketingAudit({
    actorId: userId,
    entity: 'affiliate',
    action: input.decision,
    entityPublicId: affiliate.publicId,
    metadata: { note: input.note ?? null },
  })
  return { ok: true }
}

export async function updateAffiliateStatusImpl(
  input: AffiliateStatusChangeInput,
): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const affiliate = await resolveAffiliate(input.affiliatePublicId)

  await db
    .update(affiliates)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(affiliates.id, affiliate.id))

  // Suspended affiliates keep their links in the table but they render
  // inert to checkout; pending commissions freeze while suspended.
  if (input.status === 'suspended') {
    await db
      .update(commissions)
      .set({ status: 'held', updatedAt: new Date() })
      .where(and(eq(commissions.affiliateId, affiliate.id), eq(commissions.status, 'pending')))
  }

  await writeMarketingAudit({
    actorId: userId,
    entity: 'affiliate',
    action: 'set_status',
    entityPublicId: affiliate.publicId,
    metadata: { status: input.status },
  })
  return { ok: true }
}

/**
 * Self-referral detection (S-8.4 fraud flag): a purchase attributed to the
 * affiliate's own linked account. Evidence rows are stored on the affiliate
 * so reviewers see the same-account purchases.
 */
export async function flagAffiliateFraudImpl(input: AffiliateFraudInput): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  const affiliate = await resolveAffiliate(input.affiliatePublicId)

  let evidence: { reason: string; detail?: string } | null = null
  if (input.hold) {
    const selfRows = affiliate.userId
      ? await db
          .select({ total: sql<number>`COUNT(*)::int` })
          .from(affiliateEvents)
          .where(
            and(
              eq(affiliateEvents.affiliateId, affiliate.id),
              eq(affiliateEvents.eventType, 'purchase'),
              eq(affiliateEvents.userId, affiliate.userId),
            ),
          )
      : [{ total: 0 }]

    evidence = {
      reason: 'Self-referral pattern detected',
      detail:
        Number(selfRows[0]?.total ?? 0) > 0
          ? `${selfRows[0]?.total} attributed purchase(s) came from the affiliate's own account`
          : 'Manual review hold',
    }
  }

  await db
    .update(affiliates)
    .set({
      commissionsHeld: input.hold,
      fraudFlaggedAt: input.hold ? new Date() : null,
      fraudEvidence: evidence,
      updatedAt: new Date(),
    })
    .where(eq(affiliates.id, affiliate.id))

  // Hold/release pending commissions.
  await db
    .update(commissions)
    .set(
      input.hold
        ? { status: 'held', updatedAt: new Date() }
        : { status: 'pending', updatedAt: new Date() },
    )
    .where(
      and(
        eq(commissions.affiliateId, affiliate.id),
        eq(commissions.status, input.hold ? 'pending' : 'held'),
      ),
    )

  await writeMarketingAudit({
    actorId: userId,
    entity: 'affiliate',
    action: input.hold ? 'hold_commissions' : 'release_commissions',
    entityPublicId: affiliate.publicId,
  })
  return { ok: true }
}

export async function generateAffiliateLinkImpl(
  input: AffiliateLinkInput,
): Promise<{ code: string }> {
  const userId = await requireMarketingWriteRole()
  const affiliate = await resolveAffiliate(input.affiliatePublicId)
  if (affiliate.status === 'pending' || affiliate.status === 'declined') {
    throw new Error('AFFILIATE_NOT_APPROVED:Approve the application before generating links')
  }

  let courseId: number | null = null
  let slug = affiliate.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12)
  if (input.coursePublicId) {
    const rows = await db
      .select({ id: courses.id, slug: courses.slug })
      .from(courses)
      .where(eq(courses.publicId, input.coursePublicId))
      .limit(1)
    const course = rows.at(0)
    if (!course) throw new Error('COURSE_NOT_FOUND')
    courseId = course.id
    slug = `${slug || 'partner'}-${course.slug.split('-')[0] ?? 'course'}`
  }
  if (!slug) slug = 'partner'

  // Unique code: slug + short suffix keeps codes readable and collision-safe.
  const suffix = Math.random().toString(36).slice(2, 6)
  const code = `${slug}-${suffix}`.slice(0, 60)

  const inserted = await db
    .insert(affiliateLinks)
    .values({
      affiliateId: affiliate.id,
      courseId,
      code,
    })
    .returning({ code: affiliateLinks.code })
  const created = inserted.at(0)
  if (!created) throw new Error('LINK_CREATE_FAILED')

  await writeMarketingAudit({
    actorId: userId,
    entity: 'affiliate',
    action: 'generate_link',
    entityPublicId: affiliate.publicId,
    metadata: { code: created.code },
  })
  return { code: created.code }
}

/**
 * Payout-run preview: affiliates meeting the threshold with valid payout
 * details, plus failing rows with reasons — exactly what the S-7.1
 * confirmation modal shows before the admin commits.
 */
export async function getPendingPayoutsImpl(): Promise<{
  currency: string
  threshold: number
  rows: PayoutRunRow[]
}> {
  await requirePayoutAdminRole()

  const settings = await readMarketingConfig<AffiliateProgramConfig>(
    AFFILIATE_PROGRAM_CONFIG_KEY,
    DEFAULT_AFFILIATE_PROGRAM,
  )

  const rows = await db
    .select({
      publicId: affiliates.publicId,
      name: affiliates.name,
      status: affiliates.status,
      commissionsHeld: affiliates.commissionsHeld,
      payoutDetails: affiliates.payoutDetails,
      owed: sql<string>`COALESCE(SUM(${commissions.amount}) FILTER (WHERE ${commissions.status} = 'pending'), 0)`,
    })
    .from(affiliates)
    .leftJoin(commissions, eq(commissions.affiliateId, affiliates.id))
    .where(and(isNull(affiliates.deletedAt), ne(affiliates.status, 'declined')))
    .groupBy(affiliates.id)

  const preview = buildPayoutRunRows(
    rows.map((row) => ({
      affiliatePublicId: row.publicId,
      name: row.name,
      status: row.status,
      commissionsHeld: row.commissionsHeld,
      hasPayoutDetails: row.payoutDetails != null,
      owed: round2(Number(row.owed)),
    })),
    settings.payoutThreshold,
  )

  return { currency: 'ETB', threshold: settings.payoutThreshold, rows: preview }
}

/**
 * Payout run (admin): within one transaction per affiliate, pending
 * commissions become paid under a new payout row; commissions whose
 * purchase is no longer completed (refund/failure) reverse instead.
 * Affiliates are notified through the queue transport.
 */
export async function runPayoutsImpl(): Promise<PayoutRunResult> {
  const userId = await requirePayoutAdminRole()

  const settings = await readMarketingConfig<AffiliateProgramConfig>(
    AFFILIATE_PROGRAM_CONFIG_KEY,
    DEFAULT_AFFILIATE_PROGRAM,
  )

  const rows = await db
    .select({
      publicId: affiliates.publicId,
      name: affiliates.name,
      email: affiliates.email,
      status: affiliates.status,
      commissionsHeld: affiliates.commissionsHeld,
      payoutDetails: affiliates.payoutDetails,
      owed: sql<string>`COALESCE(SUM(${commissions.amount}) FILTER (WHERE ${commissions.status} = 'pending'), 0)`,
    })
    .from(affiliates)
    .leftJoin(commissions, eq(commissions.affiliateId, affiliates.id))
    .where(and(isNull(affiliates.deletedAt), ne(affiliates.status, 'declined')))
    .groupBy(affiliates.id)

  const preview = buildPayoutRunRows(
    rows.map((row) => ({
      affiliatePublicId: row.publicId,
      name: row.name,
      status: row.status,
      commissionsHeld: row.commissionsHeld,
      hasPayoutDetails: row.payoutDetails != null,
      owed: round2(Number(row.owed)),
    })),
    settings.payoutThreshold,
  )
  const { paidTotal } = summarizePayoutRun(preview)

  const eligibleByPublicId = new Map(
    preview.filter((row) => row.eligible).map((row) => [row.affiliatePublicId, row]),
  )
  const affiliateByPublicId = new Map(rows.map((row) => [row.publicId, row]))
  let processed = 0

  for (const [publicId] of eligibleByPublicId) {
    const affiliate = affiliateByPublicId.get(publicId)
    if (!affiliate) continue
    const owed = round2(Number(affiliate.owed))

    await db.transaction(async (tx) => {
      const payoutRows = await tx
        .insert(payouts)
        .values({
          affiliateId: (
            await tx
              .select({ id: affiliates.id })
              .from(affiliates)
              .where(eq(affiliates.publicId, publicId))
              .limit(1)
          )[0].id,
          amount: owed.toFixed(2),
          currency: 'ETB',
          method: affiliate.payoutDetails?.method ?? settings.payoutMethod,
          status: 'paid',
          reference: `payout-${Date.now()}`,
          processedBy: userId,
          processedAt: new Date(),
        })
        .returning({ id: payouts.id })
      const payoutId = payoutRows[0].id

      // Refunded/failed purchases reverse their pending commission.
      await tx
        .update(commissions)
        .set({
          status: 'reversed',
          reversedReason: 'Purchase refunded or failed',
          reversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          sql`${commissions.affiliateId} = (SELECT id FROM ${affiliates} WHERE ${affiliates.publicId} = ${publicId})
              AND ${commissions.status} = 'pending'
              AND ${commissions.purchaseId} IS NOT NULL
              AND ${commissions.purchaseId} IN (SELECT ${purchases.id} FROM ${purchases} WHERE ${purchases.status} <> 'completed')`,
        )

      await tx
        .update(commissions)
        .set({ status: 'paid', payoutId, updatedAt: new Date() })
        .where(
          sql`${commissions.affiliateId} = (SELECT id FROM ${affiliates} WHERE ${affiliates.publicId} = ${publicId})
              AND ${commissions.status} = 'pending'`,
        )
    })

    await enqueueEmails([
      {
        recipientEmail: affiliate.email,
        subject: 'Your affiliate payout has been processed',
        htmlBody: `<p>Hi ${affiliate.name},</p><p>Your payout of ${owed.toFixed(2)} ETB has been processed via ${affiliate.payoutDetails?.method ?? settings.payoutMethod}.</p>`,
        idempotencyKey: `payout:${publicId}:${Date.now()}`,
      },
    ])

    processed += 1
  }

  await writeMarketingAudit({
    actorId: userId,
    entity: 'payout',
    action: 'run_payouts',
    metadata: { paidCount: processed, paidTotal },
  })

  return {
    paidCount: processed,
    paidTotal: round2(paidTotal),
    currency: 'ETB',
    failing: preview.filter((row) => !row.eligible),
  }
}

export async function getPayoutHistoryImpl(): Promise<{ items: PayoutHistoryRow[] }> {
  await requireMarketingReadRole()

  const rows = await db
    .select({
      publicId: payouts.publicId,
      affiliateName: affiliates.name,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      reference: payouts.reference,
      processedAt: payouts.processedAt,
      createdAt: payouts.createdAt,
    })
    .from(payouts)
    .innerJoin(affiliates, eq(affiliates.id, payouts.affiliateId))
    .orderBy(desc(payouts.createdAt))
    .limit(50)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      affiliateName: row.affiliateName,
      amount: Number(row.amount),
      currency: row.currency,
      method: row.method,
      status: row.status,
      reference: row.reference,
      processedAt: row.processedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}
